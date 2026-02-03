/**
 * Server health monitoring hook.
 * 
 * Tracks connectivity to the voice-server backend, separate from
 * the WebRTC connection to OpenAI. This allows showing users when
 * they're in "degraded mode" (can talk, but tools won't work).
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const BASE_URL = 'http://127.0.0.1:8080';

export type ServerStatus = 'connected' | 'disconnected' | 'checking';

export interface UseServerHealthReturn {
    serverStatus: ServerStatus;
    lastChecked: number | null;
    consecutiveFailures: number;
    checkNow: () => Promise<boolean>;
    /** Assistant name from server config (null if not yet fetched) */
    assistantName: string | null;
}

interface ServerHealthConfig {
    /** How often to check server health when connected (ms) */
    checkIntervalMs: number;
    /** How often to retry when disconnected (ms) */
    retryIntervalMs: number;
    /** Request timeout (ms) */
    timeoutMs: number;
    /** Only log every N failures to reduce console noise */
    logEveryNFailures: number;
}

const DEFAULT_CONFIG: ServerHealthConfig = {
    checkIntervalMs: 30000,      // Check every 30s when healthy
    retryIntervalMs: 15000,      // Retry every 15s when disconnected (reduced noise)
    timeoutMs: 3000,             // 3s timeout for health check
    logEveryNFailures: 4,        // Log every 4th failure (~60s at 15s retry)
};

export function useServerHealth(config: Partial<ServerHealthConfig> = {}): UseServerHealthReturn {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    
    const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');
    const [lastChecked, setLastChecked] = useState<number | null>(null);
    const [consecutiveFailures, setConsecutiveFailures] = useState(0);
    const [assistantName, setAssistantName] = useState<string | null>(null);
    
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const failureCountRef = useRef(0);

    const checkHealth = useCallback(async (): Promise<boolean> => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), cfg.timeoutMs);
            
            const response = await fetch(`${BASE_URL}/health`, {
                method: 'GET',
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                
                // Server is back/healthy
                if (serverStatus !== 'connected') {
                    console.log('[ServerHealth] Server connected');
                }
                setServerStatus('connected');
                setLastChecked(Date.now());
                setConsecutiveFailures(0);
                failureCountRef.current = 0;
                
                // Extract assistant name from server config
                if (data.assistant_name) {
                    setAssistantName(data.assistant_name);
                }
                
                return true;
            } else {
                throw new Error(`Health check failed: ${response.status}`);
            }
        } catch (err) {
            failureCountRef.current++;
            setConsecutiveFailures(failureCountRef.current);
            
            // Only log periodically to avoid console flood
            if (failureCountRef.current === 1) {
                // Always log the first failure
                console.warn('[ServerHealth] Server unreachable - tools will not work');
            } else if (failureCountRef.current % cfg.logEveryNFailures === 0) {
                // Log every Nth failure
                console.warn(`[ServerHealth] Server still unreachable (${failureCountRef.current} consecutive failures)`);
            }
            
            setServerStatus('disconnected');
            setLastChecked(Date.now());
            return false;
        }
    }, [cfg.timeoutMs, cfg.logEveryNFailures, serverStatus]);

    // Initial check and setup interval
    useEffect(() => {
        // Initial check
        checkHealth();
        
        // Set up polling interval
        const setupInterval = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            
            // Use different intervals based on connection status
            const interval = serverStatus === 'connected' 
                ? cfg.checkIntervalMs 
                : cfg.retryIntervalMs;
            
            intervalRef.current = setInterval(checkHealth, interval);
        };
        
        setupInterval();
        
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [checkHealth, serverStatus, cfg.checkIntervalMs, cfg.retryIntervalMs]);

    return {
        serverStatus,
        lastChecked,
        consecutiveFailures,
        checkNow: checkHealth,
        assistantName,
    };
}

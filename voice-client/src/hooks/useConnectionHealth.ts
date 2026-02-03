/**
 * React hook for connection health monitoring.
 * Wraps ConnectionHealthManager for easy integration with components.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    ConnectionHealthManager,
    createHealthManager,
    HealthMetrics,
    HealthConfig,
    HealthStatus,
    DisconnectReason,
} from '../lib/connectionHealth';

export interface ReconnectionConfig {
    strategy: 'manual' | 'auto_immediate' | 'auto_delayed' | 'proactive';
    autoReconnectDelayMs: number;
    proactiveReconnectAtMs: number;  // Reconnect before this session duration
    maxReconnectAttempts: number;
    keepaliveEnabled: boolean;
    keepaliveIntervalMs: number;
}

const DEFAULT_RECONNECTION_CONFIG: ReconnectionConfig = {
    strategy: 'manual',
    autoReconnectDelayMs: 3000,
    proactiveReconnectAtMs: 55 * 60 * 1000,  // 55 minutes
    maxReconnectAttempts: 5,
    keepaliveEnabled: false,
    keepaliveIntervalMs: 25000,
};

export interface UseConnectionHealthOptions {
    healthConfig?: Partial<HealthConfig>;
    reconnectionConfig?: Partial<ReconnectionConfig>;
    onReconnectNeeded?: () => Promise<void>;
}

export interface UseConnectionHealthReturn {
    // Current state
    metrics: HealthMetrics;
    healthStatus: HealthStatus;
    isMonitoring: boolean;
    
    // Formatted for display
    sessionDuration: string;
    idleTime: string;
    timeSinceLastEvent: string;
    lastDisconnectReason: DisconnectReason | null;
    reconnectCount: number;
    
    // Configuration
    reconnectionConfig: ReconnectionConfig;
    setReconnectionConfig: (config: Partial<ReconnectionConfig>) => void;
    
    // Event log for debugging
    eventLog: Array<{ event: string; timestamp: number; age: string }>;
    
    // Actions
    recordActivity: () => void;
    recordEvent: (eventType: string) => void;
    recordConnectionState: (state: string) => void;
    startSession: () => void;
    endSession: (reason?: DisconnectReason) => void;
    reset: () => void;
}

export function useConnectionHealth(
    options: UseConnectionHealthOptions = {}
): UseConnectionHealthReturn {
    const { healthConfig, reconnectionConfig: initialReconnectionConfig, onReconnectNeeded } = options;
    
    const managerRef = useRef<ConnectionHealthManager | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const keepaliveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    
    const [metrics, setMetrics] = useState<HealthMetrics>({
        sessionStartTime: null,
        lastActivityTime: null,
        lastEventTime: null,
        disconnectTime: null,
        reconnectCount: 0,
        lastDisconnectReason: null,
        connectionStateHistory: [],
        eventLog: [],
    });
    
    const [healthStatus, setHealthStatus] = useState<HealthStatus>('disconnected');
    const [isMonitoring, setIsMonitoring] = useState(false);
    const [reconnectionConfig, setReconnectionConfigState] = useState<ReconnectionConfig>({
        ...DEFAULT_RECONNECTION_CONFIG,
        ...initialReconnectionConfig,
    });

    // Track last logged status to avoid repeated logs
    const lastLoggedStatusRef = useRef<HealthStatus | null>(null);
    const lastStaleWarningRef = useRef<number>(0);
    const STALE_WARNING_INTERVAL = 30000; // Only log stale warnings every 30s

    // Initialize manager
    useEffect(() => {
        const manager = createHealthManager(healthConfig, {
            onHealthStatusChange: (status) => {
                setHealthStatus(status);
                // Only log status changes, not repeated same status
                if (status !== lastLoggedStatusRef.current) {
                    console.log(`[useConnectionHealth] Health status: ${status}`);
                    lastLoggedStatusRef.current = status;
                }
            },
            onDisconnectDetected: (reason, newMetrics) => {
                setMetrics({ ...newMetrics });
                handleDisconnect(reason);
            },
            onSessionWarning: (remainingMs) => {
                console.warn(`[useConnectionHealth] Session limit warning: ${Math.round(remainingMs / 1000)}s remaining`);
            },
            onIdleWarning: (idleMs) => {
                // Idle warnings are less critical, log at debug level
                console.debug(`[useConnectionHealth] Idle: ${Math.round(idleMs / 1000)}s`);
            },
            onStaleConnection: (timeSinceLastEventMs) => {
                // Rate-limit stale connection warnings
                const now = Date.now();
                if (now - lastStaleWarningRef.current > STALE_WARNING_INTERVAL) {
                    console.warn(`[useConnectionHealth] Stale connection: no events for ${Math.round(timeSinceLastEventMs / 1000)}s`);
                    lastStaleWarningRef.current = now;
                }
            },
        });
        
        managerRef.current = manager;
        
        return () => {
            manager.reset();
            clearTimeouts();
        };
    }, [healthConfig]);

    const clearTimeouts = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        if (keepaliveIntervalRef.current) {
            clearInterval(keepaliveIntervalRef.current);
            keepaliveIntervalRef.current = null;
        }
    }, []);

    const handleDisconnect = useCallback(async (reason: DisconnectReason) => {
        clearTimeouts();
        setIsMonitoring(false);

        // Don't auto-reconnect if user initiated or we've hit max attempts
        if (reason === 'user_initiated') {
            return;
        }

        const currentMetrics = managerRef.current?.getMetrics();
        if (currentMetrics && currentMetrics.reconnectCount >= reconnectionConfig.maxReconnectAttempts) {
            console.warn('[useConnectionHealth] Max reconnect attempts reached');
            return;
        }

        // Handle reconnection based on strategy
        switch (reconnectionConfig.strategy) {
            case 'auto_immediate':
                console.log('[useConnectionHealth] Auto-reconnecting immediately...');
                onReconnectNeeded?.();
                break;

            case 'auto_delayed':
                console.log(`[useConnectionHealth] Auto-reconnecting in ${reconnectionConfig.autoReconnectDelayMs}ms...`);
                reconnectTimeoutRef.current = setTimeout(() => {
                    onReconnectNeeded?.();
                }, reconnectionConfig.autoReconnectDelayMs);
                break;

            case 'proactive':
                // Proactive mode handles reconnection BEFORE disconnect
                // If we get here, something unexpected happened
                console.log('[useConnectionHealth] Unexpected disconnect in proactive mode');
                onReconnectNeeded?.();
                break;

            case 'manual':
            default:
                console.log('[useConnectionHealth] Manual reconnect required');
                break;
        }
    }, [reconnectionConfig, onReconnectNeeded, clearTimeouts]);

    // Set up proactive reconnection timer when session starts
    const setupProactiveReconnect = useCallback(() => {
        if (reconnectionConfig.strategy !== 'proactive') return;

        // Clear any existing timer
        clearTimeouts();

        // Set timer to reconnect before session limit
        const reconnectIn = reconnectionConfig.proactiveReconnectAtMs;
        console.log(`[useConnectionHealth] Proactive reconnect scheduled in ${Math.round(reconnectIn / 60000)}m`);

        reconnectTimeoutRef.current = setTimeout(() => {
            console.log('[useConnectionHealth] Proactive reconnection triggered');
            // End current session cleanly
            managerRef.current?.endSession('session_limit');
            // Trigger reconnection
            onReconnectNeeded?.();
        }, reconnectIn);
    }, [reconnectionConfig, onReconnectNeeded, clearTimeouts]);

    // Set up keepalive ping
    const setupKeepalive = useCallback(() => {
        if (!reconnectionConfig.keepaliveEnabled) return;

        clearTimeouts();

        keepaliveIntervalRef.current = setInterval(() => {
            // Just record activity to show we're still alive
            // The actual ping mechanism would be handled by the caller
            console.log('[useConnectionHealth] Keepalive tick');
            managerRef.current?.recordActivity();
        }, reconnectionConfig.keepaliveIntervalMs);
    }, [reconnectionConfig, clearTimeouts]);

    // Update metrics periodically for UI
    useEffect(() => {
        if (!isMonitoring) return;

        const interval = setInterval(() => {
            if (managerRef.current) {
                setMetrics({ ...managerRef.current.getMetrics() });
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isMonitoring]);

    // Actions
    const startSession = useCallback(() => {
        managerRef.current?.startSession();
        setIsMonitoring(true);
        setMetrics({ ...managerRef.current!.getMetrics() });
        setHealthStatus(managerRef.current!.getHealthStatus());
        
        setupProactiveReconnect();
        setupKeepalive();
    }, [setupProactiveReconnect, setupKeepalive]);

    const endSession = useCallback((reason: DisconnectReason = 'user_initiated') => {
        clearTimeouts();
        managerRef.current?.endSession(reason);
        setIsMonitoring(false);
        setMetrics({ ...managerRef.current!.getMetrics() });
        setHealthStatus('disconnected');
    }, [clearTimeouts]);

    const recordActivity = useCallback(() => {
        managerRef.current?.recordActivity();
    }, []);

    const recordEvent = useCallback((eventType: string) => {
        managerRef.current?.recordEvent(eventType);
    }, []);

    const recordConnectionState = useCallback((state: string) => {
        managerRef.current?.recordConnectionState(state);
        
        // Detect disconnect from connection state
        if (state === 'disconnected' || state === 'failed' || state === 'closed') {
            const reason = managerRef.current?.analyzeDisconnectReason() || 'connection_failed';
            endSession(reason);
        }
    }, [endSession]);

    const reset = useCallback(() => {
        clearTimeouts();
        managerRef.current?.reset();
        setMetrics(managerRef.current!.getMetrics());
        setHealthStatus('disconnected');
        setIsMonitoring(false);
    }, [clearTimeouts]);

    const setReconnectionConfig = useCallback((config: Partial<ReconnectionConfig>) => {
        setReconnectionConfigState(prev => {
            const newConfig = { ...prev, ...config };
            console.log('[useConnectionHealth] Config updated:', newConfig);
            return newConfig;
        });
    }, []);

    // Formatted values for display
    const sessionDuration = managerRef.current?.formatDuration(
        managerRef.current.getSessionDurationMs()
    ) || '0s';
    
    const idleTime = managerRef.current?.formatDuration(
        managerRef.current.getIdleTimeMs()
    ) || '0s';
    
    const timeSinceLastEvent = managerRef.current?.formatDuration(
        managerRef.current.getTimeSinceLastEventMs()
    ) || '0s';

    const eventLog = managerRef.current?.getEventLog() || [];

    return {
        metrics,
        healthStatus,
        isMonitoring,
        sessionDuration,
        idleTime,
        timeSinceLastEvent,
        lastDisconnectReason: metrics.lastDisconnectReason,
        reconnectCount: metrics.reconnectCount,
        reconnectionConfig,
        setReconnectionConfig,
        eventLog,
        recordActivity,
        recordEvent,
        recordConnectionState,
        startSession,
        endSession,
        reset,
    };
}

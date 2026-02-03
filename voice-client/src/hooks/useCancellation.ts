// hooks/useCancellation.ts
import { useState, useCallback, useEffect, useRef } from 'react';

interface CancellationState {
    /** Whether there are operations that can be cancelled */
    isActive: boolean;
    /** Whether cancellation has been requested */
    isCancelling: boolean;
    /** Current cancellation level if cancelling */
    level: 'graceful' | 'immediate' | null;
    /** Names of currently running tools */
    runningTools: string[];
    /** Number of active child sessions (agents) */
    activeChildren: number;
}

interface UseCancellationOptions {
    /** Base URL for the voice server API */
    serverUrl?: string;
    /** Callback when cancellation completes */
    onCancelComplete?: () => void;
}

const DEFAULT_SERVER_URL = 'http://localhost:8080';

export function useCancellation(options: UseCancellationOptions = {}) {
    const { serverUrl = DEFAULT_SERVER_URL, onCancelComplete } = options;

    const [state, setState] = useState<CancellationState>({
        isActive: false,
        isCancelling: false,
        level: null,
        runningTools: [],
        activeChildren: 0,
    });

    // Track if component is mounted to avoid state updates after unmount
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    /**
     * Request cancellation of current operations.
     * 
     * @param immediate - If true, stop immediately. If false, wait gracefully.
     */
    const requestCancel = useCallback(async (immediate: boolean = false) => {
        try {
            setState(prev => ({
                ...prev,
                isCancelling: true,
                level: immediate ? 'immediate' : 'graceful',
            }));

            const response = await fetch(`${serverUrl}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    immediate,
                    reason: immediate ? 'UI force stop' : 'UI stop button',
                }),
            });

            if (!response.ok) {
                throw new Error(`Cancel request failed: ${response.status}`);
            }

            const result = await response.json();
            console.log('[Cancel] Result:', result);

            // If nothing was running, reset immediately
            if (result.running_tools?.length === 0 && !result.was_already_cancelled) {
                if (mountedRef.current) {
                    setState(prev => ({
                        ...prev,
                        isCancelling: false,
                        level: null,
                    }));
                }
            }

            return result;
        } catch (err) {
            console.error('[Cancel] Request failed:', err);
            if (mountedRef.current) {
                setState(prev => ({
                    ...prev,
                    isCancelling: false,
                    level: null,
                }));
            }
            throw err;
        }
    }, [serverUrl]);

    /**
     * Fetch current cancellation status from server.
     * Useful for initial state or periodic polling.
     */
    const fetchStatus = useCallback(async () => {
        try {
            const response = await fetch(`${serverUrl}/cancel/status`);
            if (!response.ok) return;

            const status = await response.json();
            if (mountedRef.current) {
                setState(prev => ({
                    ...prev,
                    isActive: status.is_cancellable,
                    isCancelling: status.is_cancelled,
                    level: status.level || null,
                    runningTools: status.running_tools || [],
                    activeChildren: status.active_children || 0,
                }));
            }
        } catch (err) {
            // Silently ignore - server may not be available
            console.debug('[Cancel] Status fetch failed:', err);
        }
    }, [serverUrl]);

    /**
     * Handle SSE events related to cancellation and tool lifecycle.
     * Call this from your SSE event handler.
     */
    const handleEvent = useCallback((event: { type: string; [key: string]: unknown }) => {
        if (!mountedRef.current) return;

        switch (event.type) {
            case 'cancel_requested':
                setState(prev => ({
                    ...prev,
                    isCancelling: true,
                    level: (event.level as 'graceful' | 'immediate') || 'graceful',
                    runningTools: (event.running_tools as string[]) || prev.runningTools,
                }));
                break;

            case 'cancel_completed':
                setState(prev => ({
                    ...prev,
                    isCancelling: false,
                    level: null,
                    isActive: false,
                    runningTools: [],
                }));
                onCancelComplete?.();
                break;

            case 'tool_call':
                // Tool started - mark as active
                setState(prev => {
                    const toolName = (event.tool_name as string) || 'unknown';
                    const newTools = prev.runningTools.includes(toolName)
                        ? prev.runningTools
                        : [...prev.runningTools, toolName];
                    return {
                        ...prev,
                        isActive: true,
                        runningTools: newTools,
                    };
                });
                break;

            case 'tool_result':
            case 'tool_error':
                // Tool completed - remove from running
                setState(prev => {
                    const toolName = (event.tool_name as string) || 'unknown';
                    const newTools = prev.runningTools.filter(t => t !== toolName);
                    return {
                        ...prev,
                        isActive: newTools.length > 0 || prev.activeChildren > 0,
                        runningTools: newTools,
                        // Reset cancelling state if nothing left running
                        isCancelling: newTools.length > 0 ? prev.isCancelling : false,
                        level: newTools.length > 0 ? prev.level : null,
                    };
                });
                break;

            case 'session_fork':
                // Agent spawned - increment children
                setState(prev => ({
                    ...prev,
                    isActive: true,
                    activeChildren: prev.activeChildren + 1,
                }));
                break;

            case 'session_end':
                // Check if this is a child session ending
                // (We'd need more context to know for sure, but decrement if we have children)
                setState(prev => {
                    if (prev.activeChildren > 0) {
                        const newChildren = prev.activeChildren - 1;
                        return {
                            ...prev,
                            activeChildren: newChildren,
                            isActive: newChildren > 0 || prev.runningTools.length > 0,
                        };
                    }
                    return prev;
                });
                break;
        }
    }, [onCancelComplete]);

    /**
     * Reset cancellation state (e.g., on new session).
     */
    const reset = useCallback(() => {
        if (mountedRef.current) {
            setState({
                isActive: false,
                isCancelling: false,
                level: null,
                runningTools: [],
                activeChildren: 0,
            });
        }
    }, []);

    return {
        ...state,
        requestCancel,
        fetchStatus,
        handleEvent,
        reset,
    };
}

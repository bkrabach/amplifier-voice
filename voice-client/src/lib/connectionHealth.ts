/**
 * Connection Health Manager - tracks session metrics and detects disconnect patterns.
 * 
 * Purpose: Understand WHY sessions disconnect (idle timeout, session limit, 
 * connection degradation) before implementing fixes.
 */

export type DisconnectReason = 
    | 'idle_timeout'        // No user activity for extended period
    | 'session_limit'       // Hit OpenAI's 60-minute limit
    | 'connection_failed'   // WebRTC connection dropped
    | 'data_channel_closed' // Data channel closed unexpectedly
    | 'stale_connection'    // No events received while "connected"
    | 'network_error'       // Network connectivity issue
    | 'user_initiated'      // User clicked disconnect
    | 'unknown';

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'disconnected';

export interface HealthMetrics {
    sessionStartTime: number | null;
    lastActivityTime: number | null;     // Last user speech/input
    lastEventTime: number | null;        // Last OpenAI event received
    disconnectTime: number | null;
    reconnectCount: number;
    lastDisconnectReason: DisconnectReason | null;
    connectionStateHistory: Array<{ state: string; timestamp: number }>;
    eventLog: Array<{ event: string; timestamp: number }>;
}

export interface HealthConfig {
    idleWarningMs: number;              // Warn user about inactivity (default: 2 min)
    sessionWarningMs: number;           // Warn about approaching limit (default: 55 min)
    sessionLimitMs: number;             // OpenAI's hard limit (default: 60 min)
    staleEventThresholdMs: number;      // No events = stale connection (default: 30s)
    maxEventLogSize: number;            // Keep last N events (default: 50)
}

export interface HealthCallbacks {
    onSessionWarning?: (remainingMs: number) => void;
    onIdleWarning?: (idleMs: number) => void;
    onStaleConnection?: (timeSinceLastEventMs: number) => void;
    onDisconnectDetected?: (reason: DisconnectReason, metrics: HealthMetrics) => void;
    onHealthStatusChange?: (status: HealthStatus) => void;
}

const DEFAULT_CONFIG: HealthConfig = {
    idleWarningMs: 2 * 60 * 1000,        // 2 minutes
    sessionWarningMs: 55 * 60 * 1000,    // 55 minutes (5 min before limit)
    sessionLimitMs: 60 * 60 * 1000,      // 60 minutes (OpenAI hard limit)
    staleEventThresholdMs: 30 * 1000,    // 30 seconds
    maxEventLogSize: 50,
};

export class ConnectionHealthManager {
    private config: HealthConfig;
    private callbacks: HealthCallbacks;
    private metrics: HealthMetrics;
    private checkInterval: ReturnType<typeof setInterval> | null = null;
    private lastHealthStatus: HealthStatus = 'disconnected';
    private isConnected: boolean = false;

    constructor(config: Partial<HealthConfig> = {}, callbacks: HealthCallbacks = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.callbacks = callbacks;
        this.metrics = this.createEmptyMetrics();
    }

    private createEmptyMetrics(): HealthMetrics {
        return {
            sessionStartTime: null,
            lastActivityTime: null,
            lastEventTime: null,
            disconnectTime: null,
            reconnectCount: 0,
            lastDisconnectReason: null,
            connectionStateHistory: [],
            eventLog: [],
        };
    }

    /** Call when WebRTC connection is established */
    startSession(): void {
        const now = Date.now();
        const wasReconnect = this.metrics.sessionStartTime !== null;
        
        if (wasReconnect) {
            this.metrics.reconnectCount++;
            console.log(`[HealthManager] Session reconnected (count: ${this.metrics.reconnectCount})`);
        } else {
            console.log('[HealthManager] Session started');
        }

        this.metrics.sessionStartTime = now;
        this.metrics.lastActivityTime = now;
        this.metrics.lastEventTime = now;
        this.metrics.disconnectTime = null;
        this.isConnected = true;

        this.recordConnectionState('connected');
        this.startMonitoring();
        this.updateHealthStatus();
    }

    /** Call when connection is lost */
    endSession(reason: DisconnectReason = 'unknown'): void {
        const now = Date.now();
        this.metrics.disconnectTime = now;
        this.metrics.lastDisconnectReason = reason;
        this.isConnected = false;

        this.recordConnectionState('disconnected');
        this.stopMonitoring();

        const sessionDuration = this.getSessionDurationMs();
        const idleTime = this.getIdleTimeMs();

        console.log('[HealthManager] Session ended:', {
            reason,
            sessionDurationMs: sessionDuration,
            sessionDurationFormatted: this.formatDuration(sessionDuration),
            idleTimeMs: idleTime,
            idleTimeFormatted: this.formatDuration(idleTime),
            reconnectCount: this.metrics.reconnectCount,
        });

        this.callbacks.onDisconnectDetected?.(reason, { ...this.metrics });
        this.updateHealthStatus();
    }

    /** Call when user speaks or provides input */
    recordActivity(): void {
        this.metrics.lastActivityTime = Date.now();
        this.logEvent('user_activity');
    }

    /** Call when any OpenAI event is received */
    recordEvent(eventType: string): void {
        this.metrics.lastEventTime = Date.now();
        this.logEvent(eventType);
    }

    /** Call when WebRTC connection state changes */
    recordConnectionState(state: string): void {
        this.metrics.connectionStateHistory.push({
            state,
            timestamp: Date.now(),
        });

        // Keep history bounded
        if (this.metrics.connectionStateHistory.length > 100) {
            this.metrics.connectionStateHistory = 
                this.metrics.connectionStateHistory.slice(-100);
        }

        console.log(`[HealthManager] Connection state: ${state}`);
    }

    /** Analyze current state to determine likely disconnect reason */
    analyzeDisconnectReason(): DisconnectReason {
        const sessionDuration = this.getSessionDurationMs();
        const idleTime = this.getIdleTimeMs();
        const timeSinceLastEvent = this.getTimeSinceLastEventMs();

        // Pattern 1: Hit session limit (55+ minutes)
        if (sessionDuration >= this.config.sessionWarningMs) {
            return 'session_limit';
        }

        // Pattern 2: Stale connection (no events for 30+ seconds while "connected")
        if (timeSinceLastEvent >= this.config.staleEventThresholdMs) {
            return 'stale_connection';
        }

        // Pattern 3: Long idle (2+ min no activity, session at least 5 min old)
        if (idleTime >= this.config.idleWarningMs && sessionDuration >= 5 * 60 * 1000) {
            return 'idle_timeout';
        }

        return 'unknown';
    }

    /** Get current health status */
    getHealthStatus(): HealthStatus {
        if (!this.isConnected) {
            return 'disconnected';
        }

        const sessionDuration = this.getSessionDurationMs();
        const idleTime = this.getIdleTimeMs();
        const timeSinceLastEvent = this.getTimeSinceLastEventMs();

        // Critical: Stale connection or approaching hard limit
        if (timeSinceLastEvent >= this.config.staleEventThresholdMs ||
            sessionDuration >= this.config.sessionWarningMs) {
            return 'critical';
        }

        // Warning: Long idle or session getting long
        if (idleTime >= this.config.idleWarningMs ||
            sessionDuration >= 45 * 60 * 1000) { // 45 minutes
            return 'warning';
        }

        return 'healthy';
    }

    /** Get all current metrics */
    getMetrics(): HealthMetrics {
        return { ...this.metrics };
    }

    /** Get session duration in ms */
    getSessionDurationMs(): number {
        if (!this.metrics.sessionStartTime) return 0;
        const endTime = this.metrics.disconnectTime || Date.now();
        return endTime - this.metrics.sessionStartTime;
    }

    /** Get idle time (time since last user activity) in ms */
    getIdleTimeMs(): number {
        if (!this.metrics.lastActivityTime) return 0;
        return Date.now() - this.metrics.lastActivityTime;
    }

    /** Get time since last OpenAI event in ms */
    getTimeSinceLastEventMs(): number {
        if (!this.metrics.lastEventTime) return 0;
        return Date.now() - this.metrics.lastEventTime;
    }

    /** Format duration for display */
    formatDuration(ms: number): string {
        if (ms <= 0) return '0s';
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /** Get recent event log for debugging */
    getEventLog(): Array<{ event: string; timestamp: number; age: string }> {
        const now = Date.now();
        return this.metrics.eventLog.map(e => ({
            ...e,
            age: this.formatDuration(now - e.timestamp),
        }));
    }

    /** Reset all metrics (for fresh start) */
    reset(): void {
        this.stopMonitoring();
        this.metrics = this.createEmptyMetrics();
        this.isConnected = false;
        this.lastHealthStatus = 'disconnected';
    }

    /** Update callbacks */
    setCallbacks(callbacks: HealthCallbacks): void {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    private logEvent(eventType: string): void {
        this.metrics.eventLog.push({
            event: eventType,
            timestamp: Date.now(),
        });

        // Keep log bounded
        if (this.metrics.eventLog.length > this.config.maxEventLogSize) {
            this.metrics.eventLog = 
                this.metrics.eventLog.slice(-this.config.maxEventLogSize);
        }
    }

    private startMonitoring(): void {
        this.stopMonitoring();

        // Check health every 5 seconds
        this.checkInterval = setInterval(() => {
            this.runHealthCheck();
        }, 5000);
    }

    private stopMonitoring(): void {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }

    private runHealthCheck(): void {
        if (!this.isConnected) return;

        const sessionDuration = this.getSessionDurationMs();
        const idleTime = this.getIdleTimeMs();
        const timeSinceLastEvent = this.getTimeSinceLastEventMs();

        // Check for session limit warning
        if (sessionDuration >= this.config.sessionWarningMs) {
            const remaining = this.config.sessionLimitMs - sessionDuration;
            this.callbacks.onSessionWarning?.(remaining);
        }

        // Check for idle warning
        if (idleTime >= this.config.idleWarningMs) {
            this.callbacks.onIdleWarning?.(idleTime);
        }

        // Check for stale connection
        if (timeSinceLastEvent >= this.config.staleEventThresholdMs) {
            this.callbacks.onStaleConnection?.(timeSinceLastEvent);
        }

        this.updateHealthStatus();
    }

    private updateHealthStatus(): void {
        const newStatus = this.getHealthStatus();
        if (newStatus !== this.lastHealthStatus) {
            this.lastHealthStatus = newStatus;
            this.callbacks.onHealthStatusChange?.(newStatus);
        }
    }
}

/** Create a health manager instance */
export function createHealthManager(
    config?: Partial<HealthConfig>,
    callbacks?: HealthCallbacks
): ConnectionHealthManager {
    return new ConnectionHealthManager(config, callbacks);
}

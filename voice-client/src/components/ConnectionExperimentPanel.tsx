/**
 * Connection Experiment Panel - UI for testing different reconnection strategies.
 * 
 * Shows real-time metrics and lets you toggle experimental behaviors:
 * - Auto-reconnect strategies
 * - Keep-alive pings
 * - Session health monitoring
 */

import React, { useState } from 'react';
import {
    makeStyles,
    tokens,
    Switch,
    Dropdown,
    Option,
    Text,
    Badge,
    Divider,
    Tooltip,
} from '@fluentui/react-components';
import {
    ChevronDownRegular,
    ChevronUpRegular,
    HeartPulseRegular,
    ArrowSyncRegular,
    TimerRegular,
    HistoryRegular,
    InfoRegular,
} from '@fluentui/react-icons';
import { HealthStatus, DisconnectReason } from '../lib/connectionHealth';
import { ReconnectionConfig } from '../hooks/useConnectionHealth';

const useStyles = makeStyles({
    root: {
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        overflow: 'hidden',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
        cursor: 'pointer',
        backgroundColor: tokens.colorNeutralBackground3,
        '&:hover': {
            backgroundColor: tokens.colorNeutralBackground3Hover,
        },
    },
    headerTitle: {
        flex: 1,
        fontWeight: tokens.fontWeightSemibold,
        fontSize: tokens.fontSizeBase200,
    },
    content: {
        padding: tokens.spacingHorizontalM,
    },
    section: {
        marginBottom: tokens.spacingVerticalM,
    },
    sectionTitle: {
        fontSize: tokens.fontSizeBase200,
        fontWeight: tokens.fontWeightSemibold,
        color: tokens.colorNeutralForeground2,
        marginBottom: tokens.spacingVerticalXS,
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
    },
    metricsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: tokens.spacingHorizontalS,
    },
    metricItem: {
        backgroundColor: tokens.colorNeutralBackground1,
        padding: tokens.spacingHorizontalS,
        borderRadius: tokens.borderRadiusSmall,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    metricLabel: {
        fontSize: tokens.fontSizeBase100,
        color: tokens.colorNeutralForeground3,
        marginBottom: '2px',
    },
    metricValue: {
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
        fontFamily: 'monospace',
    },
    settingRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: tokens.spacingVerticalXS,
        paddingBottom: tokens.spacingVerticalXS,
    },
    settingLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
        fontSize: tokens.fontSizeBase200,
    },
    eventLog: {
        maxHeight: '120px',
        overflowY: 'auto',
        backgroundColor: tokens.colorNeutralBackground1,
        borderRadius: tokens.borderRadiusSmall,
        padding: tokens.spacingHorizontalS,
        fontFamily: 'monospace',
        fontSize: tokens.fontSizeBase100,
        border: `1px solid ${tokens.colorNeutralStroke2}`,
    },
    eventEntry: {
        display: 'flex',
        justifyContent: 'space-between',
        color: tokens.colorNeutralForeground3,
        lineHeight: 1.4,
    },
    statusHealthy: { color: tokens.colorPaletteGreenForeground1 },
    statusWarning: { color: tokens.colorPaletteYellowForeground1 },
    statusCritical: { color: tokens.colorPaletteRedForeground1 },
    statusDisconnected: { color: tokens.colorNeutralForeground3 },
    lastDisconnect: {
        backgroundColor: tokens.colorPaletteRedBackground1,
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
        borderRadius: tokens.borderRadiusSmall,
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorPaletteRedForeground1,
        marginTop: tokens.spacingVerticalXS,
    },
});

interface ConnectionExperimentPanelProps {
    // Current state
    healthStatus: HealthStatus;
    sessionDuration: string;
    idleTime: string;
    timeSinceLastEvent: string;
    lastDisconnectReason: DisconnectReason | null;
    reconnectCount: number;
    isMonitoring: boolean;
    eventLog: Array<{ event: string; timestamp: number; age: string }>;
    
    // Configuration
    reconnectionConfig: ReconnectionConfig;
    onConfigChange: (config: Partial<ReconnectionConfig>) => void;
}

const STRATEGY_OPTIONS = [
    { key: 'manual', text: 'Manual', description: 'Click to reconnect' },
    { key: 'auto_immediate', text: 'Auto (immediate)', description: 'Reconnect instantly on disconnect' },
    { key: 'auto_delayed', text: 'Auto (3s delay)', description: 'Wait 3 seconds before reconnecting' },
    { key: 'proactive', text: 'Proactive (55m)', description: 'Reconnect before session limit' },
];

const getStatusBadgeColor = (status: HealthStatus) => {
    switch (status) {
        case 'healthy': return 'success';
        case 'warning': return 'warning';
        case 'critical': return 'danger';
        default: return 'informative';
    }
};

const getStatusText = (status: HealthStatus) => {
    switch (status) {
        case 'healthy': return '● Healthy';
        case 'warning': return '◐ Warning';
        case 'critical': return '○ Critical';
        default: return '○ Disconnected';
    }
};

const formatDisconnectReason = (reason: DisconnectReason): string => {
    const labels: Record<DisconnectReason, string> = {
        idle_timeout: 'Idle Timeout',
        session_limit: 'Session Limit (60m)',
        connection_failed: 'Connection Failed',
        data_channel_closed: 'Data Channel Closed',
        stale_connection: 'Stale Connection',
        network_error: 'Network Error',
        user_initiated: 'User Disconnected',
        unknown: 'Unknown',
    };
    return labels[reason] || reason;
};

export const ConnectionExperimentPanel: React.FC<ConnectionExperimentPanelProps> = ({
    healthStatus,
    sessionDuration,
    idleTime,
    timeSinceLastEvent,
    lastDisconnectReason,
    reconnectCount,
    isMonitoring: _isMonitoring,  // Available for future use
    eventLog,
    reconnectionConfig,
    onConfigChange,
}) => {
    const styles = useStyles();
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className={styles.root}>
            {/* Collapsible Header */}
            <div 
                className={styles.header}
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <HeartPulseRegular />
                <span className={styles.headerTitle}>Connection Health</span>
                <Badge 
                    appearance="filled" 
                    color={getStatusBadgeColor(healthStatus)}
                    size="small"
                >
                    {getStatusText(healthStatus)}
                </Badge>
                {isExpanded ? <ChevronUpRegular /> : <ChevronDownRegular />}
            </div>

            {/* Expanded Content */}
            {isExpanded && (
                <div className={styles.content}>
                    {/* Real-time Metrics */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>
                            <TimerRegular />
                            <span>Session Metrics</span>
                        </div>
                        <div className={styles.metricsGrid}>
                            <div className={styles.metricItem}>
                                <div className={styles.metricLabel}>Session Duration</div>
                                <div className={styles.metricValue}>{sessionDuration}</div>
                            </div>
                            <div className={styles.metricItem}>
                                <div className={styles.metricLabel}>Idle Time</div>
                                <div className={styles.metricValue}>{idleTime}</div>
                            </div>
                            <div className={styles.metricItem}>
                                <div className={styles.metricLabel}>Last Event</div>
                                <div className={styles.metricValue}>{timeSinceLastEvent}</div>
                            </div>
                            <div className={styles.metricItem}>
                                <div className={styles.metricLabel}>Reconnects</div>
                                <div className={styles.metricValue}>{reconnectCount}</div>
                            </div>
                        </div>
                        
                        {lastDisconnectReason && lastDisconnectReason !== 'user_initiated' && (
                            <div className={styles.lastDisconnect}>
                                ⚠️ Last disconnect: {formatDisconnectReason(lastDisconnectReason)}
                            </div>
                        )}
                    </div>

                    <Divider />

                    {/* Reconnection Strategy */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>
                            <ArrowSyncRegular />
                            <span>Reconnection Strategy</span>
                            <Tooltip 
                                content="Choose how the app handles disconnections"
                                relationship="label"
                            >
                                <InfoRegular style={{ fontSize: '12px' }} />
                            </Tooltip>
                        </div>
                        
                        <div className={styles.settingRow}>
                            <Text className={styles.settingLabel}>Strategy</Text>
                            <Dropdown
                                value={STRATEGY_OPTIONS.find(o => o.key === reconnectionConfig.strategy)?.text}
                                selectedOptions={[reconnectionConfig.strategy]}
                                onOptionSelect={(_, data) => {
                                    onConfigChange({ strategy: data.optionValue as ReconnectionConfig['strategy'] });
                                }}
                                size="small"
                                style={{ minWidth: '150px' }}
                            >
                                {STRATEGY_OPTIONS.map(option => (
                                    <Option key={option.key} value={option.key}>
                                        {option.text}
                                    </Option>
                                ))}
                            </Dropdown>
                        </div>

                        <div className={styles.settingRow}>
                            <Text className={styles.settingLabel}>
                                Keep-alive Ping
                                <Tooltip 
                                    content="Send periodic activity to prevent idle timeout"
                                    relationship="label"
                                >
                                    <InfoRegular style={{ fontSize: '12px', marginLeft: '4px' }} />
                                </Tooltip>
                            </Text>
                            <Switch
                                checked={reconnectionConfig.keepaliveEnabled}
                                onChange={(_, data) => {
                                    onConfigChange({ keepaliveEnabled: data.checked });
                                }}
                            />
                        </div>
                    </div>

                    <Divider />

                    {/* Event Log */}
                    <div className={styles.section}>
                        <div className={styles.sectionTitle}>
                            <HistoryRegular />
                            <span>Recent Events ({eventLog.length})</span>
                        </div>
                        <div className={styles.eventLog}>
                            {eventLog.length === 0 ? (
                                <div className={styles.eventEntry}>
                                    <span>No events yet</span>
                                </div>
                            ) : (
                                eventLog.slice(-15).reverse().map((entry, i) => (
                                    <div key={i} className={styles.eventEntry}>
                                        <span>{entry.event}</span>
                                        <span>{entry.age} ago</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

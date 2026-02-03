// components/StopButton.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    makeStyles,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import { Stop24Regular, Stop24Filled } from '@fluentui/react-icons';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    button: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: tokens.spacingHorizontalXS,
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
        borderRadius: tokens.borderRadiusMedium,
        border: 'none',
        cursor: 'pointer',
        fontSize: tokens.fontSizeBase300,
        fontWeight: tokens.fontWeightSemibold,
        transition: 'all 0.15s ease',
        minWidth: '100px',
    },
    buttonIdle: {
        backgroundColor: tokens.colorNeutralBackground3,
        color: tokens.colorNeutralForeground3,
        cursor: 'not-allowed',
        opacity: 0.5,
    },
    buttonActive: {
        backgroundColor: tokens.colorPaletteRedBackground2,
        color: tokens.colorPaletteRedForeground2,
        ':hover': {
            backgroundColor: tokens.colorPaletteRedBackground3,
        },
    },
    buttonHolding: {
        backgroundColor: tokens.colorPaletteRedForeground1,
        color: tokens.colorNeutralForegroundOnBrand,
    },
    buttonCancelling: {
        backgroundColor: tokens.colorPaletteYellowBackground2,
        color: tokens.colorPaletteYellowForeground2,
        cursor: 'wait',
    },
    progressBar: {
        position: 'absolute' as const,
        bottom: 0,
        left: 0,
        height: '3px',
        backgroundColor: tokens.colorPaletteRedForeground1,
        borderRadius: `0 0 ${tokens.borderRadiusMedium} ${tokens.borderRadiusMedium}`,
        transition: 'width 0.1s linear',
    },
    buttonWrapper: {
        position: 'relative' as const,
        overflow: 'hidden',
        borderRadius: tokens.borderRadiusMedium,
    },
    statusText: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        fontStyle: 'italic',
    },
});

// Hold duration for immediate cancel (2 seconds)
const HOLD_FOR_IMMEDIATE_MS = 2000;

interface StopButtonProps {
    /** Whether there are operations that can be cancelled */
    isActive: boolean;
    /** Whether cancellation is already in progress */
    isCancelling: boolean;
    /** Names of running tools/operations for display */
    runningTools: string[];
    /** Number of active child sessions */
    activeChildren: number;
    /** Callback when cancel is requested */
    onCancel: (immediate: boolean) => Promise<void>;
}

export const StopButton: React.FC<StopButtonProps> = ({
    isActive,
    isCancelling,
    runningTools,
    activeChildren,
    onCancel,
}) => {
    const styles = useStyles();
    const [holdStart, setHoldStart] = useState<number | null>(null);
    const [holdProgress, setHoldProgress] = useState(0);
    const holdIntervalRef = useRef<number | null>(null);

    // Clean up interval on unmount
    useEffect(() => {
        return () => {
            if (holdIntervalRef.current) {
                clearInterval(holdIntervalRef.current);
            }
        };
    }, []);

    const startHold = useCallback(() => {
        if (!isActive || isCancelling) return;
        
        const now = Date.now();
        setHoldStart(now);
        setHoldProgress(0);

        // Update progress every 50ms
        holdIntervalRef.current = window.setInterval(() => {
            const elapsed = Date.now() - now;
            const progress = Math.min(elapsed / HOLD_FOR_IMMEDIATE_MS, 1);
            setHoldProgress(progress);
        }, 50);
    }, [isActive, isCancelling]);

    const endHold = useCallback(async () => {
        if (holdIntervalRef.current) {
            clearInterval(holdIntervalRef.current);
            holdIntervalRef.current = null;
        }

        if (!holdStart || !isActive || isCancelling) {
            setHoldStart(null);
            setHoldProgress(0);
            return;
        }

        const holdDuration = Date.now() - holdStart;
        const immediate = holdDuration >= HOLD_FOR_IMMEDIATE_MS;

        setHoldStart(null);
        setHoldProgress(0);

        try {
            await onCancel(immediate);
        } catch (err) {
            console.error('Cancel failed:', err);
        }
    }, [holdStart, isActive, isCancelling, onCancel]);

    // Determine button state and styling
    const getButtonState = () => {
        if (isCancelling) {
            return { className: styles.buttonCancelling, label: 'Cancelling...' };
        }
        if (holdStart) {
            const isImmediate = holdProgress >= 1;
            return { 
                className: styles.buttonHolding, 
                label: isImmediate ? 'Force Stop!' : 'Hold to force...' 
            };
        }
        if (isActive) {
            return { className: styles.buttonActive, label: 'Stop' };
        }
        return { className: styles.buttonIdle, label: 'Stop' };
    };

    const { className: buttonStateClass, label } = getButtonState();

    // Build tooltip content
    const getTooltip = () => {
        if (isCancelling) {
            return 'Cancellation in progress...';
        }
        if (!isActive) {
            return 'No operations running';
        }
        const parts = [];
        if (runningTools.length > 0) {
            parts.push(`Running: ${runningTools.join(', ')}`);
        }
        if (activeChildren > 0) {
            parts.push(`${activeChildren} active agent${activeChildren > 1 ? 's' : ''}`);
        }
        parts.push('Click: graceful stop');
        parts.push('Hold 2s: force stop');
        return parts.join('\n');
    };

    return (
        <div className={styles.container}>
            <Tooltip
                content={getTooltip()}
                relationship="description"
                positioning="above"
            >
                <div className={styles.buttonWrapper}>
                    <button
                        className={`${styles.button} ${buttonStateClass}`}
                        onMouseDown={startHold}
                        onMouseUp={endHold}
                        onMouseLeave={endHold}
                        onTouchStart={startHold}
                        onTouchEnd={endHold}
                        disabled={!isActive || isCancelling}
                        aria-label={isActive ? 'Stop current operation' : 'No operation to stop'}
                    >
                        {holdStart ? <Stop24Filled /> : <Stop24Regular />}
                        {label}
                    </button>
                    {holdStart && (
                        <div 
                            className={styles.progressBar} 
                            style={{ width: `${holdProgress * 100}%` }}
                        />
                    )}
                </div>
            </Tooltip>
            {isActive && runningTools.length > 0 && (
                <span className={styles.statusText}>
                    {runningTools.join(', ')}
                </span>
            )}
        </div>
    );
};

/**
 * MicrophoneControls - Context-aware microphone control UI.
 * 
 * Displays different controls based on current microphone state:
 * - Normal: Shows mute button and pause replies button
 * - Paused: Shows mute button, respond now button, and resume button
 * - Muted: Shows unmute button
 */

import React from 'react';
import {
    makeStyles,
    mergeClasses,
    tokens,
    Button,
    Tooltip,
    Badge,
} from '@fluentui/react-components';
import {
    MicRegular,
    MicOffFilled,
    MicPulseRegular,
    PlayRegular,
    ArrowResetRegular,
} from '@fluentui/react-icons';
import type { MicrophoneState } from '../hooks/useMicrophoneControl';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
        padding: tokens.spacingVerticalM,
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium,
    },
    statusRow: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
    },
    statusIndicator: {
        width: '10px',
        height: '10px',
        borderRadius: '50%',
    },
    statusNormal: {
        backgroundColor: tokens.colorPaletteGreenBackground3,
    },
    statusPaused: {
        backgroundColor: tokens.colorPaletteYellowBackground3,
    },
    statusMuted: {
        backgroundColor: tokens.colorPaletteRedBackground3,
    },
    statusText: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground2,
    },
    controlsRow: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        flexWrap: 'wrap',
    },
    muteButton: {
        minWidth: '100px',
    },
    mutedButton: {
        backgroundColor: tokens.colorPaletteRedBackground2,
        color: tokens.colorPaletteRedForeground2,
        ':hover': {
            backgroundColor: tokens.colorPaletteRedBackground3,
        },
    },
    pauseRepliesButton: {
        backgroundColor: tokens.colorPaletteYellowBackground2,
        color: tokens.colorPaletteYellowForeground2,
        ':hover': {
            backgroundColor: tokens.colorPaletteYellowBackground3,
        },
    },
    respondButton: {
        backgroundColor: tokens.colorPaletteGreenBackground2,
        color: tokens.colorPaletteGreenForeground2,
        ':hover': {
            backgroundColor: tokens.colorPaletteGreenBackground3,
        },
    },
    hint: {
        fontSize: tokens.fontSizeBase100,
        color: tokens.colorNeutralForeground3,
        fontStyle: 'italic',
        marginTop: tokens.spacingVerticalXS,
    },
});

export interface MicrophoneControlsProps {
    /** Current microphone state */
    micState: MicrophoneState;
    /** Whether voice connection is active */
    connected: boolean;
    /** Assistant name for voice commands hint */
    assistantName: string;
    /** Callback to toggle mute */
    onToggleMute: () => void;
    /** Callback to pause replies */
    onPauseReplies: () => void;
    /** Callback to resume replies */
    onResumeReplies: () => void;
    /** Callback to trigger response */
    onTriggerResponse: () => void;
}

export const MicrophoneControls: React.FC<MicrophoneControlsProps> = ({
    micState,
    connected,
    assistantName,
    onToggleMute,
    onPauseReplies,
    onResumeReplies,
    onTriggerResponse,
}) => {
    const styles = useStyles();

    if (!connected) {
        return null;
    }

    const getStatusInfo = () => {
        switch (micState) {
            case 'normal':
                return {
                    class: styles.statusNormal,
                    text: 'Listening & Responding',
                    badge: 'success' as const,
                };
            case 'paused':
                return {
                    class: styles.statusPaused,
                    text: 'Replies Paused (Still Recording)',
                    badge: 'warning' as const,
                };
            case 'muted':
                return {
                    class: styles.statusMuted,
                    text: 'Muted',
                    badge: 'danger' as const,
                };
        }
    };

    const statusInfo = getStatusInfo();

    return (
        <div className={styles.container}>
            {/* Status indicator */}
            <div className={styles.statusRow}>
                <div className={mergeClasses(styles.statusIndicator, statusInfo.class)} />
                <span className={styles.statusText}>{statusInfo.text}</span>
                {micState === 'paused' && (
                    <Badge appearance="filled" color="warning" size="small">
                        Recording
                    </Badge>
                )}
            </div>

            {/* Controls - context-aware */}
            <div className={styles.controlsRow}>
                {/* Mute/Unmute button - always visible */}
                <Tooltip
                    content={micState === 'muted' ? 'Unmute microphone' : 'Mute microphone'}
                    relationship="label"
                >
                    <Button
                        className={mergeClasses(styles.muteButton, micState === 'muted' && styles.mutedButton)}
                        appearance={micState === 'muted' ? 'primary' : 'secondary'}
                        icon={micState === 'muted' ? <MicOffFilled /> : <MicRegular />}
                        onClick={onToggleMute}
                    >
                        {micState === 'muted' ? 'Unmute' : 'Mute'}
                    </Button>
                </Tooltip>

                {/* Normal mode: Show pause replies button */}
                {micState === 'normal' && (
                    <Tooltip
                        content="Pause replies - I'll keep transcribing but won't respond automatically"
                        relationship="label"
                    >
                        <Button
                            className={styles.pauseRepliesButton}
                            appearance="secondary"
                            icon={<MicPulseRegular />}
                            onClick={onPauseReplies}
                        >
                            Pause Replies
                        </Button>
                    </Tooltip>
                )}

                {/* Paused mode: Show respond now and resume buttons */}
                {micState === 'paused' && (
                    <>
                        <Tooltip
                            content="Trigger a response now"
                            relationship="label"
                        >
                            <Button
                                className={styles.respondButton}
                                appearance="primary"
                                icon={<PlayRegular />}
                                onClick={onTriggerResponse}
                            >
                                Respond Now
                            </Button>
                        </Tooltip>
                        <Tooltip
                            content="Resume automatic replies"
                            relationship="label"
                        >
                            <Button
                                appearance="secondary"
                                icon={<ArrowResetRegular />}
                                onClick={onResumeReplies}
                            >
                                Resume
                            </Button>
                        </Tooltip>
                    </>
                )}
            </div>

            {/* Voice command hints */}
            {micState === 'paused' && (
                <div className={styles.hint}>
                    💡 Say "Hey {assistantName}, respond now" or "go ahead" to trigger a response
                </div>
            )}
            {micState === 'normal' && (
                <div className={styles.hint}>
                    💡 Say "Hey {assistantName}, pause" to pause replies
                </div>
            )}
        </div>
    );
};

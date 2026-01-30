// components/VoiceChat.tsx
import React, { useState } from 'react';
import {
    makeStyles,
    tokens
} from '@fluentui/react-components';
import { useVoiceChat } from '../hooks/useVoiceChat';
import { ControlsPanel } from './ControlsPanel';
import { TranscriptDisplay } from './TranscriptDisplay';
import { SessionPicker } from './SessionPicker';

const useStyles = makeStyles({
    wrapper: {
        width: '100%',
        height: '100vh',
        display: 'flex',
        backgroundColor: tokens.colorNeutralBackground1
    },
    container: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalM,
        padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
        borderBottom: `1px solid ${tokens.colorNeutralStroke1}`,
        backgroundColor: tokens.colorNeutralBackground2,
    },
    historyBtn: {
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
        backgroundColor: tokens.colorNeutralBackground3,
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: tokens.borderRadiusMedium,
        cursor: 'pointer',
        fontSize: tokens.fontSizeBase200,
        ':hover': {
            backgroundColor: tokens.colorNeutralBackground4,
        }
    },
    sessionId: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
        fontFamily: 'monospace',
    },
    content: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0 // Enables proper flex scrolling
    },
    controls: {
        boxSizing: 'border-box',
        padding: tokens.spacingHorizontalL,
        borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    },
    audio: {
        display: 'none'
    }
});

export const VoiceChat: React.FC = () => {
    const styles = useStyles();
    const [showSessionPicker, setShowSessionPicker] = useState(false);
    const { 
        connected, 
        transcripts, 
        audioRef, 
        sessionId,
        startVoiceChat, 
        resumeVoiceChat,
        disconnectVoiceChat 
    } = useVoiceChat();

    const handleSessionSelect = async (selectedSessionId: string, isResume: boolean) => {
        if (isResume) {
            try {
                await resumeVoiceChat(selectedSessionId);
            } catch (err) {
                console.error('Failed to resume session:', err);
            }
        }
    };

    const handleNewSession = async () => {
        await startVoiceChat();
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.container}>
                {/* Header with session info and picker button */}
                <div className={styles.header}>
                    <button 
                        className={styles.historyBtn}
                        onClick={() => setShowSessionPicker(true)}
                        title="View session history"
                    >
                        📋 Sessions
                    </button>
                    {sessionId && (
                        <span className={styles.sessionId}>
                            Session: {sessionId.slice(0, 8)}...
                        </span>
                    )}
                </div>
                
                <div className={styles.content}>
                    <TranscriptDisplay transcripts={transcripts} />
                </div>
                <div className={styles.controls}>
                    <ControlsPanel
                        connected={connected}
                        onStart={startVoiceChat}
                        onDisconnect={disconnectVoiceChat}
                    />
                </div>
            </div>
            <audio ref={audioRef} autoPlay className={styles.audio} />
            
            <SessionPicker
                isOpen={showSessionPicker}
                onClose={() => setShowSessionPicker(false)}
                onSessionSelect={handleSessionSelect}
                onNewSession={handleNewSession}
            />
        </div>
    );
};

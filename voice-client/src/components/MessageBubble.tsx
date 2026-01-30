// components/MessageBubble.tsx
import React from 'react';
import {
    CopilotMessageV2 as CopilotMessage,
    UserMessageV2 as UserMessage,
} from "@fluentui-copilot/react-copilot";
import { makeStyles, tokens, Spinner, Badge } from '@fluentui/react-components';
import { Message } from '../models/Message';
import { IncomingIndicator } from './IncomingIndicator';

const useStyles = makeStyles({
    systemMessage: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 16px',
        fontSize: '13px',
        color: tokens.colorNeutralForeground3,
        fontStyle: 'italic',
    },
    toolStatus: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 12px',
        borderRadius: '4px',
        backgroundColor: tokens.colorNeutralBackground3,
        fontSize: '12px',
    },
    toolStatusExecuting: {
        color: tokens.colorBrandForeground1,
    },
    toolStatusCompleted: {
        color: tokens.colorPaletteGreenForeground1,
    },
    toolStatusError: {
        color: tokens.colorPaletteRedForeground1,
    },
    displayInfo: {
        color: tokens.colorNeutralForeground2,
    },
    displayWarning: {
        color: tokens.colorPaletteYellowForeground1,
    },
    displayError: {
        color: tokens.colorPaletteRedForeground1,
    },
    displaySuccess: {
        color: tokens.colorPaletteGreenForeground1,
    },
});

interface MessageBubbleProps {
    message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
    const styles = useStyles();
    const isAssistant = message.sender === 'assistant';
    const isSystem = message.sender === 'system' || message.isSystem;

    // Timestamp available if needed: new Date(message.timestamp).toLocaleTimeString()

    // We use a state variable for the current time to force re-renders.
    const [currentTime, setCurrentTime] = React.useState(Date.now());

    React.useEffect(() => {
        // Only start the timer if the message is streaming.
        if (message.isStreaming) {
            const interval = setInterval(() => {
                setCurrentTime(Date.now());
            }, 500); // Update every 500ms to ensure smooth transitions.
            return () => clearInterval(interval);
        }
    }, [message.isStreaming, message.text]);

    // Calculate the difference between now and when the message was updated.
    const lastUpdateTime = message.timestamp ? new Date(message.timestamp).getTime() : 0;
    const isRecentlyUpdated = currentTime - lastUpdateTime < 2000; // 2 seconds in ms

    // Handle system messages (tool status, display messages)
    if (isSystem) {
        // Tool status messages
        if (message.type === 'tool_status') {
            const statusClass = message.toolStatus === 'executing'
                ? styles.toolStatusExecuting
                : message.toolStatus === 'completed'
                    ? styles.toolStatusCompleted
                    : styles.toolStatusError;

            return (
                <div className={`${styles.toolStatus} ${statusClass}`}>
                    {message.toolStatus === 'executing' && (
                        <Spinner size="tiny" />
                    )}
                    {message.toolStatus === 'completed' && (
                        <Badge appearance="filled" color="success" size="tiny" />
                    )}
                    {message.toolStatus === 'error' && (
                        <Badge appearance="filled" color="danger" size="tiny" />
                    )}
                    <span>{message.text}</span>
                </div>
            );
        }

        // Display messages (info, warning, error, success)
        if (message.type === 'display') {
            const levelClass = message.displayLevel === 'warning'
                ? styles.displayWarning
                : message.displayLevel === 'error'
                    ? styles.displayError
                    : message.displayLevel === 'success'
                        ? styles.displaySuccess
                        : styles.displayInfo;

            return (
                <div className={`${styles.systemMessage} ${levelClass}`}>
                    <span>{message.text}</span>
                </div>
            );
        }

        // Generic system message
        return (
            <div className={styles.systemMessage}>
                <span>{message.text}</span>
            </div>
        );
    }

    // Show IncomingIndicator only if the message is streaming and has been updated in the last 2 seconds.
    const content = (
        <span>
            {message.text}
            {message.isStreaming && isRecentlyUpdated && <IncomingIndicator />}
        </span>
    );

    return isAssistant ? (
        <CopilotMessage name="Amplifier" avatar={<div>🤖</div>}>
            {content}
        </CopilotMessage>
    ) : (
        <UserMessage>
            {content}
        </UserMessage>
    );
};

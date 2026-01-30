// components/TranscriptDisplay.tsx
import React from 'react';
import { makeStyles, tokens } from '@fluentui/react-components';
import { CopilotChat } from "@fluentui-copilot/react-copilot";
import { MessageBubble } from './MessageBubble';
import { Message } from '../models/Message';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
        height: '100%',
        overflowY: 'auto',
        padding: tokens.spacingVerticalL,
        backgroundColor: tokens.colorNeutralBackground2
    }
});

interface TranscriptDisplayProps {
    transcripts: Message[];
}

export const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({ transcripts }) => {
    const styles = useStyles();
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [transcripts]);

    return (
        <div className={styles.container} ref={containerRef}>
            <CopilotChat>
                {transcripts.map((message, index) => (
                    <MessageBubble
                        key={index}
                        message={message}
                    />
                ))}
            </CopilotChat>
        </div>
    );
};

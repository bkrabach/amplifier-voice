import {
    FluentProvider,
    webLightTheme,
    makeStyles,
} from '@fluentui/react-components';
import { VoiceChat } from './components/VoiceChat';
import { useAmplifierEvents } from './hooks/useAmplifierEvents';
import React from 'react';

const useStyles = makeStyles({
    root: {
        width: '100%',
        display: 'flex'
    }
});

export const App: React.FC = () => {
    const styles = useStyles();
    
    // Initialize Amplifier event streaming for debugging
    // Events are logged to browser console with color-coded icons
    // Open DevTools Console to see: 🔼 LLM requests, 🔽 responses, 🔧 tools, 🔀 agent spawns
    const { connected, eventCount } = useAmplifierEvents({
        autoConnect: true,
        logToConsole: true,
    });

    // Log connection status on mount
    React.useEffect(() => {
        if (connected) {
            console.log(
                '%c[AmplifierEvents] Debug stream active - watching for events...',
                'color: #8b5cf6; font-weight: bold;'
            );
        }
    }, [connected]);

    // Log event count periodically (every 50 events)
    React.useEffect(() => {
        if (eventCount > 0 && eventCount % 50 === 0) {
            console.log(
                `%c[AmplifierEvents] ${eventCount} events captured`,
                'color: #6b7280;'
            );
        }
    }, [eventCount]);

    return (
        <FluentProvider theme={webLightTheme} className={styles.root}>
            <VoiceChat />
        </FluentProvider>
    );
};

import {
    FluentProvider,
    webLightTheme,
    makeStyles,
} from '@fluentui/react-components';
import { VoiceChat } from './components/VoiceChat';
import React from 'react';

const useStyles = makeStyles({
    root: {
        width: '100%',
        display: 'flex'
    }
});

export const App: React.FC = () => {
    const styles = useStyles();
    
    // Note: Amplifier event streaming is now handled in VoiceChat component
    // where it's wired up to the cancellation handler for tracking tool state

    return (
        <FluentProvider theme={webLightTheme} className={styles.root}>
            <VoiceChat />
        </FluentProvider>
    );
};

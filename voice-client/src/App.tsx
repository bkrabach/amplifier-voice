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
    return (
        <FluentProvider theme={webLightTheme} className={styles.root}>
            <VoiceChat />
        </FluentProvider>
    );
};

import React from 'react';
import {
    Button,
    makeStyles,
    tokens,
    Badge,
    Text
} from '@fluentui/react-components';
import { PhoneFilled, DismissCircleFilled } from '@fluentui/react-icons';

interface ControlsPanelProps {
    connected: boolean;
    connecting?: boolean;
    onStart: () => void;
    onDisconnect: () => void;
}

const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: tokens.spacingHorizontalL,
        padding: tokens.spacingVerticalM,
        backgroundColor: tokens.colorNeutralBackground2,
        borderRadius: tokens.borderRadiusMedium
    },
});

export const ControlsPanel: React.FC<ControlsPanelProps> = ({ connected, connecting, onStart, onDisconnect }) => {
    const styles = useStyles();

    return (
        <div className={styles.root}>
            {connected === false ? (
                <Button
                    appearance="primary"
                    icon={<PhoneFilled />}
                    onClick={onStart}
                    disabled={connecting}
                >
                    {connecting ? 'Connecting...' : 'Start Voice Chat'}
                </Button>
            ) : (
                <Button
                    appearance="secondary"
                    icon={<DismissCircleFilled />}
                    onClick={onDisconnect}
                >
                    Disconnect
                </Button>
            )}
            <Badge
                appearance='filled'
                color={connected ? "success" : connecting ? "warning" : "severe"}
            >
                <Text>{connected ? "Connected" : connecting ? "Connecting" : "Disconnected"}</Text>
            </Badge>
        </div>
    );
};

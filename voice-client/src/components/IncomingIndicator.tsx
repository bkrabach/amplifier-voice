// components/IncomingIndicator.tsx
import React from 'react';
import { makeStyles } from '@fluentui/react-components';

const useStyles = makeStyles({
    dots: {
        display: 'inline-block',
    },
    dot: {
        display: 'inline-block',
        width: '3px',
        height: '3px',
        backgroundColor: 'currentColor',
        borderRadius: '50%',
        marginLeft: '2px',
        animation: 'blink 1s infinite'
    }
});

export const IncomingIndicator: React.FC = () => {
    const styles = useStyles();
    return (
        <span className={styles.dots}>
            {[0, 0.2, 0.4].map(delay => (
                <span key={delay} className={styles.dot} style={{ animationDelay: `${delay}s` }} />
            ))}
        </span>
    );
}

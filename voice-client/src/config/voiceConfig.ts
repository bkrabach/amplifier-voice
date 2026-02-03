/**
 * Voice Chat Configuration
 * 
 * Configuration values for the voice chat client.
 * Can be overridden via environment variables at build time.
 */

export interface VoiceConfig {
    /** 
     * Assistant name used for voice keywords (e.g., "Hey Amplifier, pause replies")
     * Default: "Amplifier"
     */
    assistantName: string;

    /**
     * Server URL for the voice backend
     * Default: "http://127.0.0.1:8080"
     */
    serverUrl: string;

    /**
     * Enable voice keyword detection
     * Default: true
     */
    voiceKeywordsEnabled: boolean;

    /**
     * Debounce time for voice keywords in milliseconds
     * Default: 2000
     */
    voiceKeywordDebounceMs: number;
}

// Read from environment variables (Vite exposes these via import.meta.env)
const getEnvVar = (key: string, defaultValue: string): string => {
    // Vite environment variables
    if (typeof import.meta !== 'undefined' && import.meta.env) {
        const value = import.meta.env[`VITE_${key}`];
        if (value !== undefined) {
            return value;
        }
    }
    return defaultValue;
};

const getEnvBool = (key: string, defaultValue: boolean): boolean => {
    const value = getEnvVar(key, String(defaultValue));
    return value.toLowerCase() === 'true';
};

const getEnvNumber = (key: string, defaultValue: number): number => {
    const value = getEnvVar(key, String(defaultValue));
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};

/**
 * Voice configuration with defaults.
 * 
 * Override via environment variables:
 * - VITE_ASSISTANT_NAME: Assistant name for voice keywords
 * - VITE_SERVER_URL: Backend server URL
 * - VITE_VOICE_KEYWORDS_ENABLED: Enable/disable voice keywords
 * - VITE_VOICE_KEYWORD_DEBOUNCE_MS: Debounce time for keywords
 */
export const voiceConfig: VoiceConfig = {
    assistantName: getEnvVar('ASSISTANT_NAME', 'Amplifier'),
    serverUrl: getEnvVar('SERVER_URL', 'http://127.0.0.1:8080'),
    voiceKeywordsEnabled: getEnvBool('VOICE_KEYWORDS_ENABLED', true),
    voiceKeywordDebounceMs: getEnvNumber('VOICE_KEYWORD_DEBOUNCE_MS', 2000),
};

export default voiceConfig;

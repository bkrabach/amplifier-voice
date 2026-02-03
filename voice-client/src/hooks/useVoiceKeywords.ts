/**
 * useVoiceKeywords - Detects voice commands in transcription events.
 * 
 * Listens for keywords like:
 * - "Hey {assistantName}, pause replies" → Pause replies (keep transcribing)
 * - "Hey {assistantName}, respond now" / "go ahead" → Trigger response
 * - "Hey {assistantName}, resume" → Resume normal replies
 * - "Hey {assistantName}, mute" / "unmute" → Toggle mute
 * 
 * Uses fuzzy matching to handle transcription variations.
 */

import { useCallback, useRef, useEffect } from 'react';

export interface VoiceKeywordConfig {
    /** Assistant name for wake word (default: "Amplifier") */
    assistantName: string;
    /** Whether keyword detection is enabled */
    enabled: boolean;
    /** Debounce time in ms to prevent duplicate triggers */
    debounceMs: number;
}

export type VoiceCommand = 
    | 'pause_replies'
    | 'resume_replies' 
    | 'respond_now'
    | 'mute'
    | 'unmute';

export interface VoiceKeywordCallbacks {
    onPauseReplies?: () => void;
    onResumeReplies?: () => void;
    onRespondNow?: () => void;
    onMute?: () => void;
    onUnmute?: () => void;
}

export interface UseVoiceKeywordsReturn {
    /** Process a transcription text for keywords */
    processTranscription: (text: string) => VoiceCommand | null;
    /** Update configuration */
    updateConfig: (config: Partial<VoiceKeywordConfig>) => void;
    /** Current config */
    config: VoiceKeywordConfig;
}

const DEFAULT_CONFIG: VoiceKeywordConfig = {
    assistantName: 'Amplifier',
    enabled: true,
    debounceMs: 2000, // 2 second debounce to prevent repeated triggers
};

// Command patterns - will be filled with assistant name
interface CommandPattern {
    command: VoiceCommand;
    patterns: string[];
}

function buildCommandPatterns(assistantName: string): CommandPattern[] {
    const name = assistantName.toLowerCase();
    const wakeWords = [
        `hey ${name}`,
        `hi ${name}`,
        `ok ${name}`,
        `okay ${name}`,
        name, // Just the name alone
    ];

    return [
        {
            command: 'pause_replies',
            patterns: wakeWords.flatMap(wake => [
                `${wake} pause replies`,
                `${wake} pause`,
                `${wake} hold on`,
                `${wake} just listen`,
                `${wake} listen for a bit`,
                `${wake} listen for a while`,
                `${wake} be quiet`,
                `${wake} quiet mode`,
                `${wake} shh`,
                `${wake} hush`,
            ]),
        },
        {
            command: 'resume_replies',
            patterns: wakeWords.flatMap(wake => [
                `${wake} resume replies`,
                `${wake} resume`,
                `${wake} normal mode`,
                `${wake} you can talk now`,
                `${wake} talk to me`,
            ]),
        },
        {
            command: 'respond_now',
            patterns: [
                // Wake word + explicit commands
                ...wakeWords.flatMap(wake => [
                    `${wake} respond now`,
                    `${wake} respond`,
                    `${wake} go ahead`,
                    `${wake} your turn`,
                    `${wake} what do you think`,
                    `${wake} thoughts`,
                    `${wake} over to you`,
                ]),
                // Also match without wake word for common phrases
                'go ahead',
                'your turn',
                'over to you',
                'what do you think',
            ],
        },
        {
            command: 'mute',
            patterns: wakeWords.flatMap(wake => [
                `${wake} mute`,
                `${wake} stop listening`,
            ]),
        },
        {
            command: 'unmute',
            patterns: wakeWords.flatMap(wake => [
                `${wake} unmute`,
                `${wake} start listening`,
                `${wake} i'm back`,
            ]),
        },
    ];
}

/**
 * Normalize text for matching - handles common transcription variations
 */
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[.,!?;:'"]/g, '') // Remove punctuation
        .replace(/\s+/g, ' ')        // Normalize whitespace
        .trim();
}

/**
 * Check if text contains a pattern (fuzzy match)
 */
function containsPattern(text: string, pattern: string): boolean {
    const normalizedText = normalizeText(text);
    const normalizedPattern = normalizeText(pattern);
    
    // Direct substring match
    if (normalizedText.includes(normalizedPattern)) {
        return true;
    }
    
    // Check if words from pattern appear in sequence (with possible words between)
    const patternWords = normalizedPattern.split(' ');
    const textWords = normalizedText.split(' ');
    
    let patternIdx = 0;
    for (const word of textWords) {
        if (word === patternWords[patternIdx]) {
            patternIdx++;
            if (patternIdx === patternWords.length) {
                return true;
            }
        }
    }
    
    return false;
}

export function useVoiceKeywords(
    callbacks: VoiceKeywordCallbacks,
    initialConfig: Partial<VoiceKeywordConfig> = {}
): UseVoiceKeywordsReturn {
    const configRef = useRef<VoiceKeywordConfig>({
        ...DEFAULT_CONFIG,
        ...initialConfig,
    });
    
    const lastTriggerRef = useRef<{ command: VoiceCommand; time: number } | null>(null);
    const commandPatternsRef = useRef<CommandPattern[]>(
        buildCommandPatterns(configRef.current.assistantName)
    );
    const callbacksRef = useRef(callbacks);

    // Keep callbacks ref updated
    useEffect(() => {
        callbacksRef.current = callbacks;
    }, [callbacks]);

    const updateConfig = useCallback((newConfig: Partial<VoiceKeywordConfig>) => {
        configRef.current = { ...configRef.current, ...newConfig };
        
        // Rebuild patterns if assistant name changed
        if (newConfig.assistantName) {
            commandPatternsRef.current = buildCommandPatterns(newConfig.assistantName);
        }
    }, []);

    const processTranscription = useCallback((text: string): VoiceCommand | null => {
        if (!configRef.current.enabled) {
            return null;
        }

        const now = Date.now();
        const patterns = commandPatternsRef.current;

        // Check each command pattern
        for (const { command, patterns: commandPatterns } of patterns) {
            for (const pattern of commandPatterns) {
                if (containsPattern(text, pattern)) {
                    // Check debounce
                    const lastTrigger = lastTriggerRef.current;
                    if (
                        lastTrigger &&
                        lastTrigger.command === command &&
                        now - lastTrigger.time < configRef.current.debounceMs
                    ) {
                        // Debounced - same command triggered recently
                        return null;
                    }

                    // Record trigger
                    lastTriggerRef.current = { command, time: now };

                    // Execute callback
                    const cbs = callbacksRef.current;
                    switch (command) {
                        case 'pause_replies':
                            cbs.onPauseReplies?.();
                            break;
                        case 'resume_replies':
                            cbs.onResumeReplies?.();
                            break;
                        case 'respond_now':
                            cbs.onRespondNow?.();
                            break;
                        case 'mute':
                            cbs.onMute?.();
                            break;
                        case 'unmute':
                            cbs.onUnmute?.();
                            break;
                    }

                    console.log(`[VoiceKeywords] Detected command: ${command} (matched: "${pattern}")`);
                    return command;
                }
            }
        }

        return null;
    }, []);

    return {
        processTranscription,
        updateConfig,
        config: configRef.current,
    };
}

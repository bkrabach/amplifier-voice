/**
 * useMicrophoneControl - Manages microphone state for voice chat.
 * 
 * Supports three states:
 * - normal: Audio flows, model responds automatically
 * - paused: Audio flows & transcribes, but model doesn't auto-respond (replies paused)
 * - muted: No audio sent at all
 * 
 * "Pause Replies" mode uses OpenAI's turn_detection.create_response: false
 * to keep capturing audio without triggering responses.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export type MicrophoneState = 'normal' | 'paused' | 'muted';

export interface MicrophoneControlConfig {
    /** Assistant name for voice keywords (default: "Amplifier") */
    assistantName: string;
}

export interface UseMicrophoneControlReturn {
    /** Current microphone state */
    micState: MicrophoneState;
    /** Whether the mic is currently muted (track disabled) */
    isMuted: boolean;
    /** Whether replies are paused (capturing but not responding) */
    isPaused: boolean;
    /** Set the audio track to control */
    setAudioTrack: (track: MediaStreamTrack | null) => void;
    /** Set the data channel for sending API messages */
    setDataChannel: (channel: RTCDataChannel | null) => void;
    /** Toggle mute on/off */
    toggleMute: () => void;
    /** Pause replies (keep capturing but don't respond) */
    pauseReplies: () => void;
    /** Resume replies and return to normal */
    resumeReplies: () => void;
    /** Trigger a response (useful when replies are paused) */
    triggerResponse: () => void;
    /** Set state directly */
    setMicState: (state: MicrophoneState) => void;
    /** Current config */
    config: MicrophoneControlConfig;
    /** Update config */
    updateConfig: (config: Partial<MicrophoneControlConfig>) => void;
    /** 
     * Check if auto-response should be allowed (reads current state via ref).
     * Use this in callbacks to avoid stale closure issues.
     */
    shouldAutoRespond: () => boolean;
}

const DEFAULT_CONFIG: MicrophoneControlConfig = {
    assistantName: 'Amplifier',
};

export function useMicrophoneControl(
    initialConfig: Partial<MicrophoneControlConfig> = {}
): UseMicrophoneControlReturn {
    const [config, setConfig] = useState<MicrophoneControlConfig>({
        ...DEFAULT_CONFIG,
        ...initialConfig,
    });
    
    const [micState, setMicState] = useState<MicrophoneState>('normal');
    const audioTrackRef = useRef<MediaStreamTrack | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    const previousStateRef = useRef<MicrophoneState>('normal');
    
    // Ref to track current state for callbacks (avoids stale closure issues)
    // Synced via useEffect to handle both direct values and updater functions
    const micStateRef = useRef<MicrophoneState>('normal');
    
    // Keep ref in sync with actual state (handles updater functions correctly)
    useEffect(() => {
        console.log('[MicControl] State synced to ref:', micState);
        micStateRef.current = micState;
    }, [micState]);

    // Derived states for convenience
    const isMuted = micState === 'muted';
    const isPaused = micState === 'paused';
    
    // Callback-safe function to check if auto-respond is allowed
    // Uses ref to always get current state, avoiding stale closures
    const shouldAutoRespond = useCallback(() => {
        const currentState = micStateRef.current;
        const allowed = currentState === 'normal';
        console.log('[MicControl] shouldAutoRespond check: state=', currentState, 'allowed=', allowed);
        return allowed;
    }, []);

    const setAudioTrack = useCallback((track: MediaStreamTrack | null) => {
        audioTrackRef.current = track;
        // Apply current mute state to new track
        if (track) {
            track.enabled = micState !== 'muted';
        }
    }, [micState]);

    const setDataChannel = useCallback((channel: RTCDataChannel | null) => {
        dataChannelRef.current = channel;
    }, []);

    const updateConfig = useCallback((newConfig: Partial<MicrophoneControlConfig>) => {
        setConfig(prev => ({ ...prev, ...newConfig }));
    }, []);

    // Send session.update to OpenAI API
    const sendSessionUpdate = useCallback((createResponse: boolean) => {
        const dc = dataChannelRef.current;
        if (!dc || dc.readyState !== 'open') {
            console.warn('[MicControl] Cannot send session update - data channel not ready');
            return false;
        }

        const message = {
            type: 'session.update',
            session: {
                type: 'realtime',  // Required by GA API
                audio: {
                    input: {
                        turn_detection: {
                            type: 'semantic_vad',
                            create_response: createResponse,
                            interrupt_response: createResponse,
                        },
                    },
                },
            },
        };

        try {
            dc.send(JSON.stringify(message));
            console.log(`[MicControl] Session updated: create_response=${createResponse}`);
            return true;
        } catch (err) {
            console.error('[MicControl] Failed to send session update:', err);
            return false;
        }
    }, []);

    // Send response.create to trigger a response
    const sendResponseCreate = useCallback(() => {
        const dc = dataChannelRef.current;
        if (!dc || dc.readyState !== 'open') {
            console.warn('[MicControl] Cannot trigger response - data channel not ready');
            return false;
        }

        try {
            dc.send(JSON.stringify({ type: 'response.create' }));
            console.log('[MicControl] Response triggered');
            return true;
        } catch (err) {
            console.error('[MicControl] Failed to trigger response:', err);
            return false;
        }
    }, []);

    // Apply track-level mute
    const applyTrackMute = useCallback((muted: boolean) => {
        const track = audioTrackRef.current;
        if (track) {
            track.enabled = !muted;
            console.log(`[MicControl] Audio track ${muted ? 'disabled' : 'enabled'}`);
        }
    }, []);

    const toggleMute = useCallback(() => {
        setMicState(prev => {
            if (prev === 'muted') {
                // Unmuting - return to previous state
                const newState = previousStateRef.current === 'muted' ? 'normal' : previousStateRef.current;
                applyTrackMute(false);
                // NOTE: Don't send session update here - muting only affects the audio track.
                // The create_response setting is controlled separately by pause replies.
                // If returning from muted to paused mode, keep create_response: false
                // If returning from muted to normal mode, the initial setup already has
                // create_response: false and we manually call response.create after transcription
                return newState;
            } else {
                // Muting - save current state and mute
                previousStateRef.current = prev;
                applyTrackMute(true);
                return 'muted';
            }
        });
    }, [applyTrackMute]);

    const pauseReplies = useCallback(() => {
        if (micState === 'muted') {
            // If muted, unmute first then pause replies
            applyTrackMute(false);
        }
        
        if (sendSessionUpdate(false)) {
            setMicState('paused');
            console.log('[MicControl] Replies paused');
        }
    }, [micState, applyTrackMute, sendSessionUpdate]);

    const resumeReplies = useCallback(() => {
        // Note: We do NOT send create_response: true here.
        // Our system uses manual response.create calls (handled by useChatMessages).
        // Just update the state - the next transcription will trigger response.create normally.
        setMicState('normal');
        console.log('[MicControl] Replies resumed');
    }, []);

    const triggerResponse = useCallback(() => {
        if (sendResponseCreate()) {
            // Optionally resume replies after triggering response
            // For now, stay paused - user can explicitly resume
            console.log('[MicControl] Response triggered while paused');
        }
    }, [sendResponseCreate]);

    // Handle direct state changes
    const handleSetMicState = useCallback((newState: MicrophoneState) => {
        const currentState = micState;
        
        if (newState === currentState) return;

        // Handle track muting
        if (newState === 'muted') {
            previousStateRef.current = currentState;
            applyTrackMute(true);
        } else if (currentState === 'muted') {
            applyTrackMute(false);
        }

        // Handle API-level changes for paused mode ONLY
        // Our system uses create_response: false by default and manually triggers responses.
        // We only need to tell OpenAI to suppress create_response when pausing replies,
        // NOT to enable it when resuming (our manual response.create handles normal mode).
        if (newState === 'paused') {
            sendSessionUpdate(false);
        }
        // Note: We intentionally do NOT send create_response: true when resuming
        // or unmuting. Our useChatMessages handles response creation manually.

        setMicState(newState);
    }, [micState, applyTrackMute, sendSessionUpdate]);

    // Sync track state when micState changes externally
    useEffect(() => {
        const track = audioTrackRef.current;
        if (track) {
            track.enabled = micState !== 'muted';
        }
    }, [micState]);

    return {
        micState,
        isMuted,
        isPaused,
        setAudioTrack,
        setDataChannel,
        toggleMute,
        pauseReplies,
        resumeReplies,
        triggerResponse,
        setMicState: handleSetMicState,
        config,
        updateConfig,
        shouldAutoRespond,
    };
}

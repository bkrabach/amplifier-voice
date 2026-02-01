// hooks/useVoiceChat.ts
import { useCallback } from 'react';
import { useWebRTC, WebRTCHealthCallbacks } from './useWebRTC';
import { useChatMessages } from './useChatMessages';
import { useConnectionHealth, ReconnectionConfig } from './useConnectionHealth';
import { VoiceChatEvent } from '../models/VoiceChatEvent';
import { useTranscriptStore, SessionEndReason } from '../stores/transcriptStore';
import { DisconnectReason } from '../lib/connectionHealth';

export const useVoiceChat = () => {
    const { 
        connected, 
        connecting,
        error: connectionError,
        connectionState,
        dataChannelState,
        audioRef, 
        connect, 
        disconnect, 
        injectContext 
    } = useWebRTC();
    
    const { messages, handleEvent, clearMessages, loadPreviousMessages } = useChatMessages();
    
    const { 
        sessionId, 
        createSession, 
        resumeSession, 
        syncToServer,
        endSession,
        clearSession 
    } = useTranscriptStore();

    // Connection health monitoring
    const health = useConnectionHealth({
        healthConfig: {
            idleWarningMs: 2 * 60 * 1000,        // 2 minutes
            sessionWarningMs: 55 * 60 * 1000,    // 55 minutes
            staleEventThresholdMs: 30 * 1000,    // 30 seconds no events
        },
        onReconnectNeeded: async () => {
            console.log('[VoiceChat] Auto-reconnect triggered');
            // Auto-reconnect uses the current session
            if (sessionId) {
                try {
                    await resumeVoiceChat(sessionId);
                } catch (err) {
                    console.error('[VoiceChat] Auto-reconnect failed:', err);
                }
            }
        },
    });

    // Create health callbacks to wire WebRTC events to health manager
    const createHealthCallbacks = useCallback((): WebRTCHealthCallbacks => ({
        onConnectionStateChange: (state) => {
            health.recordConnectionState(state);
        },
        onDataChannelStateChange: (state) => {
            if (state === 'open') {
                health.startSession();
            }
        },
        onEvent: (eventType) => {
            health.recordEvent(eventType);
            // User speech events count as activity
            if (eventType.includes('input_audio') || eventType.includes('speech')) {
                health.recordActivity();
            }
        },
        onDisconnect: (reason) => {
            const healthReason: DisconnectReason = 
                reason === 'user_initiated' ? 'user_initiated' :
                reason === 'connection_failed' ? 'connection_failed' :
                reason === 'data_channel_closed' ? 'data_channel_closed' :
                reason === 'ice_failed' ? 'network_error' : 'unknown';
            health.endSession(healthReason);
            
            // Map WebRTC disconnect reason to session end reason for tracking
            const sessionEndReason: SessionEndReason = 
                reason === 'user_initiated' ? 'user_ended' :
                reason === 'ice_failed' ? 'network_error' :
                reason === 'connection_failed' ? 'network_error' :
                reason === 'data_channel_closed' ? 'network_error' : 'error';
            
            // Record disconnect on server for analytics
            endSession(sessionEndReason, reason !== 'user_initiated' ? `WebRTC: ${reason}` : undefined);
        },
    }), [health]);

    const startVoiceChat = async () => {
        try {
            // Create a new session for transcript tracking
            const newSessionId = await createSession();
            console.log('[VoiceChat] Created session:', newSessionId);
            
            await connect(
                (data: string, dataChannel: RTCDataChannel) => {
                    try {
                        const event = JSON.parse(data) as VoiceChatEvent;
                        handleEvent(event, dataChannel);
                    } catch (err) {
                        console.debug('Error parsing event:', err);
                    }
                },
                undefined,  // No existing token for new session
                createHealthCallbacks()
            );
        } catch (err) {
            console.error('Error starting voice chat:', err);
        }
    };

    const resumeVoiceChat = async (sessionIdToResume: string) => {
        try {
            console.log('[VoiceChat] Resuming session:', sessionIdToResume);
            
            // Get resumption data (context + new OpenAI session)
            const resumeData = await resumeSession(sessionIdToResume);
            
            // Load previous messages into the UI for display
            if (resumeData.transcript && resumeData.transcript.length > 0) {
                console.log('[VoiceChat] Loading', resumeData.transcript.length, 'previous messages into UI');
                loadPreviousMessages(resumeData.transcript);
            }
            
            // Connect with the new OpenAI session
            await connect(
                (data: string, dataChannel: RTCDataChannel) => {
                    try {
                        const event = JSON.parse(data) as VoiceChatEvent;
                        handleEvent(event, dataChannel);
                    } catch (err) {
                        console.debug('Error parsing event:', err);
                    }
                },
                resumeData.realtime.client_secret.value,
                createHealthCallbacks()
            );
            
            // Inject conversation context after connection is established
            if (resumeData.context_to_inject && resumeData.context_to_inject.length > 0) {
                console.log('[VoiceChat] Injecting', resumeData.context_to_inject.length, 'context items');
                // Small delay to ensure WebRTC is fully ready
                setTimeout(() => {
                    injectContext(resumeData.context_to_inject);
                }, 500);
            }
        } catch (err) {
            console.error('Error resuming voice chat:', err);
            throw err;
        }
    };

    const disconnectVoiceChat = async () => {
        // Sync any pending transcript entries before disconnecting
        await syncToServer();
        // End session with user_ended reason (explicit disconnect)
        await endSession('user_ended');
        disconnect();
    };

    // Config change handler for the experiment panel
    const setReconnectionConfig = useCallback((config: Partial<ReconnectionConfig>) => {
        health.setReconnectionConfig(config);
    }, [health]);

    return {
        // Connection state
        connected,
        connecting,
        connectionError,
        connectionState,
        dataChannelState,
        
        // Chat state
        transcripts: messages,
        audioRef,
        sessionId,
        
        // Actions
        startVoiceChat,
        resumeVoiceChat,
        disconnectVoiceChat,
        clearMessages,
        clearSession,
        
        // Health monitoring (for ConnectionExperimentPanel)
        healthStatus: health.healthStatus,
        sessionDuration: health.sessionDuration,
        idleTime: health.idleTime,
        timeSinceLastEvent: health.timeSinceLastEvent,
        lastDisconnectReason: health.lastDisconnectReason,
        reconnectCount: health.reconnectCount,
        isMonitoring: health.isMonitoring,
        eventLog: health.eventLog,
        reconnectionConfig: health.reconnectionConfig,
        setReconnectionConfig,
    };
};

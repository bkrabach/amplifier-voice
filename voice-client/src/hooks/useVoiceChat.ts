// hooks/useVoiceChat.ts
import { useCallback, useRef } from 'react';
import { useWebRTC, WebRTCHealthCallbacks } from './useWebRTC';
import { useChatMessages } from './useChatMessages';
import { useConnectionHealth, ReconnectionConfig } from './useConnectionHealth';
import { useServerHealth } from './useServerHealth';
import { useMicrophoneControl } from './useMicrophoneControl';
import { useVoiceKeywords } from './useVoiceKeywords';
import { useCancellation } from './useCancellation';
import { VoiceChatEvent } from '../models/VoiceChatEvent';
import { useTranscriptStore, SessionEndReason } from '../stores/transcriptStore';
import { DisconnectReason } from '../lib/connectionHealth';
import { voiceConfig } from '../config/voiceConfig';

// Voice control tools that are handled client-side
// Include both old and new names for backwards compatibility with cached sessions
const CLIENT_SIDE_TOOLS = new Set([
    'pause_replies', 'resume_replies',           // New names
    'enter_listen_mode', 'exit_listen_mode',     // Old names (for cached sessions)
]);

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
    
    // Microphone control (mute, pause replies) - declare early for shouldAutoRespond
    const micControl = useMicrophoneControl({
        assistantName: voiceConfig.assistantName,  // Will be updated when server provides name
    });

    // Chat messages with auto-respond check based on mic state
    // Uses micControl.shouldAutoRespond which reads from ref to avoid stale closures
    const { messages, handleEvent, clearMessages, loadPreviousMessages, addSystemMessage } = useChatMessages({
        shouldAutoRespond: micControl.shouldAutoRespond,
    });
    
    // Server health monitoring (separate from WebRTC connection)
    const { 
        serverStatus, 
        consecutiveFailures: serverFailures,
        checkNow: checkServerNow,
        assistantName: serverAssistantName,
    } = useServerHealth();

    // Use server-provided assistant name if available, fall back to local config
    const assistantName = serverAssistantName || voiceConfig.assistantName;

    // Cancellation state and controls
    const cancellation = useCancellation({
        serverUrl: 'http://localhost:8080',
        onCancelComplete: () => {
            console.log('[VoiceChat] Cancellation completed');
        },
    });

    // Update microphone control with server-provided assistant name
    // (micControl declared earlier for shouldAutoRespond callback)

    // Track data channel for microphone control
    const dataChannelRef = useRef<RTCDataChannel | null>(null);

    // Voice keyword detection
    const voiceKeywords = useVoiceKeywords(
        {
            onPauseReplies: () => {
                console.log('[VoiceChat] Voice keyword: pause replies');
                micControl.pauseReplies();
            },
            onResumeReplies: () => {
                console.log('[VoiceChat] Voice keyword: resume replies');
                micControl.resumeReplies();
            },
            onRespondNow: () => {
                console.log('[VoiceChat] Voice keyword: respond now');
                micControl.triggerResponse();
                // Also resume replies when responding
                micControl.resumeReplies();
            },
            onMute: () => {
                console.log('[VoiceChat] Voice keyword: mute');
                if (!micControl.isMuted) {
                    micControl.toggleMute();
                }
            },
            onUnmute: () => {
                console.log('[VoiceChat] Voice keyword: unmute');
                if (micControl.isMuted) {
                    micControl.toggleMute();
                }
            },
        },
        { 
            assistantName,  // Use dynamic name from server or fallback
            enabled: voiceConfig.voiceKeywordsEnabled,
            debounceMs: voiceConfig.voiceKeywordDebounceMs,
        }
    );

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
        onAudioTrack: (track) => {
            // Wire up audio track to mic control for muting
            micControl.setAudioTrack(track);
            console.log('[VoiceChat] Audio track connected to mic control');
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

    // Handle voice control tool calls (client-side execution)
    const handleVoiceControlTool = useCallback((
        toolName: string,
        callId: string,
        dataChannel: RTCDataChannel
    ): boolean => {
        if (!CLIENT_SIDE_TOOLS.has(toolName)) {
            return false; // Not a client-side tool
        }

        console.log(`[VoiceChat] Handling client-side tool: ${toolName}`);

        // Normalize tool name for consistent handling
        const isPause = toolName === 'pause_replies' || toolName === 'enter_listen_mode';
        const isResume = toolName === 'resume_replies' || toolName === 'exit_listen_mode';

        // Execute the appropriate action
        if (isPause) {
            micControl.pauseReplies();
            addSystemMessage('Replies paused - still listening', '⏸️');
        } else if (isResume) {
            micControl.resumeReplies();
            addSystemMessage('Replies resumed', '▶️');
        } else {
            console.warn(`[VoiceChat] Unknown client-side tool: ${toolName}`);
            return false;
        }

        // Send tool result back to OpenAI so the model knows it succeeded
        if (callId && dataChannel.readyState === 'open') {
            const resultMessage = isPause 
                ? 'Replies paused. I am still listening and will transcribe what you say. Say "go ahead" or "respond now" when you want me to reply.'
                : 'Replies resumed. I will now respond to your speech normally.';
            
            // Send the function call output
            const toolResult = {
                type: 'conversation.item.create',
                item: {
                    type: 'function_call_output',
                    call_id: callId,
                    output: JSON.stringify({ success: true, message: resultMessage })
                }
            };
            dataChannel.send(JSON.stringify(toolResult));
            console.log(`[VoiceChat] Sent tool result for ${toolName}`);

            // Trigger a response so the model can acknowledge
            const responseCreate = {
                type: 'response.create'
            };
            dataChannel.send(JSON.stringify(responseCreate));
            console.log(`[VoiceChat] Triggered response for ${toolName} acknowledgment`);
        }
        
        return true; // Handled
    }, [micControl, addSystemMessage]);

    // Process transcription events for voice keywords
    const processTranscriptionForKeywords = useCallback((text: string) => {
        if (text && text.length > 0) {
            voiceKeywords.processTranscription(text);
        }
    }, [voiceKeywords]);

    // Enhanced event handler that processes voice control tools and keywords
    const createEventHandler = useCallback((dataChannel: RTCDataChannel) => {
        return (data: string) => {
            try {
                const event = JSON.parse(data) as VoiceChatEvent;

                // Check for function call events (voice control tools)
                // Handle client-side and DON'T pass to handleEvent (which would try to execute via Amplifier)
                
                // Intercept response.output_item.added/done for function calls
                if (event.type === 'response.output_item.added' || event.type === 'response.output_item.done') {
                    const itemEvent = event as { item?: { type?: string; name?: string; call_id?: string } };
                    if (itemEvent.item?.type === 'function_call' && itemEvent.item?.name && CLIENT_SIDE_TOOLS.has(itemEvent.item.name)) {
                        if (event.type === 'response.output_item.added') {
                            // Execute the client-side tool when the item is added
                            handleVoiceControlTool(itemEvent.item.name, itemEvent.item.call_id || '', dataChannel);
                        }
                        // Skip passing to handleEvent - we handled it client-side
                        return;
                    }
                }
                
                // ALSO intercept response.function_call_arguments.done - this is what triggers executeToolCall
                if (event.type === 'response.function_call_arguments.done') {
                    const fnEvent = event as { name?: string; call_id?: string };
                    if (fnEvent.name && CLIENT_SIDE_TOOLS.has(fnEvent.name)) {
                        // Skip - already handled via response.output_item.added
                        return;
                    }
                }

                // Check for transcription events (for keyword detection)
                if (event.type === 'conversation.item.input_audio_transcription.completed') {
                    const transcriptEvent = event as { transcript?: string };
                    if (transcriptEvent.transcript) {
                        processTranscriptionForKeywords(transcriptEvent.transcript);
                    }
                }

                // Pass all other events to the regular handler
                handleEvent(event, dataChannel);
            } catch (err) {
                console.debug('Error parsing event:', err);
            }
        };
    }, [handleEvent, handleVoiceControlTool, processTranscriptionForKeywords]);

    const startVoiceChat = async () => {
        try {
            // Create a new session for transcript tracking
            const newSessionId = await createSession();
            console.log('[VoiceChat] Created session:', newSessionId);
            
            await connect(
                (data: string, dataChannel: RTCDataChannel) => {
                    // Store data channel reference for microphone control
                    if (dataChannel !== dataChannelRef.current) {
                        dataChannelRef.current = dataChannel;
                        micControl.setDataChannel(dataChannel);
                    }
                    createEventHandler(dataChannel)(data);
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
                    // Store data channel reference for microphone control
                    if (dataChannel !== dataChannelRef.current) {
                        dataChannelRef.current = dataChannel;
                        micControl.setDataChannel(dataChannel);
                    }
                    createEventHandler(dataChannel)(data);
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
        
        // Server health (separate from WebRTC)
        serverStatus,
        serverFailures,
        checkServerNow,
        
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
        
        // Microphone control
        micState: micControl.micState,
        isMuted: micControl.isMuted,
        isPaused: micControl.isPaused,
        toggleMute: micControl.toggleMute,
        pauseReplies: micControl.pauseReplies,
        resumeReplies: micControl.resumeReplies,
        triggerResponse: micControl.triggerResponse,
        assistantName,  // Dynamic from server or fallback to local config
        
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
        
        // Cancellation controls
        cancelState: {
            isActive: cancellation.isActive,
            isCancelling: cancellation.isCancelling,
            runningTools: cancellation.runningTools,
            activeChildren: cancellation.activeChildren,
        },
        requestCancel: cancellation.requestCancel,
        handleCancelEvent: cancellation.handleEvent,
    };
};

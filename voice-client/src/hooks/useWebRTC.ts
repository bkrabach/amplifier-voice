/**
 * WebRTC hook for OpenAI Realtime API voice connections.
 *
 * This hook manages:
 * - WebRTC peer connection lifecycle
 * - Audio stream capture and playback
 * - Data channel for events/messages
 * - Session creation and SDP exchange
 */

import { useRef, useState, useCallback } from 'react';

// Server base URL
const BASE_URL = 'http://127.0.0.1:8080';

interface WebRTCState {
    connected: boolean;
    connecting: boolean;
    error: string | null;
    connectionState: string;  // Track detailed connection state
    dataChannelState: string; // Track data channel state
}

// Callbacks for health monitoring integration
export interface WebRTCHealthCallbacks {
    onConnectionStateChange?: (state: string) => void;
    onDataChannelStateChange?: (state: 'open' | 'closed') => void;
    onEvent?: (eventType: string) => void;
    onDisconnect?: (reason: 'connection_failed' | 'data_channel_closed' | 'ice_failed' | 'user_initiated') => void;
    onAudioTrack?: (track: MediaStreamTrack) => void;
}

export const useWebRTC = () => {
    const [state, setState] = useState<WebRTCState>({
        connected: false,
        connecting: false,
        error: null,
        connectionState: 'new',
        dataChannelState: 'closed'
    });

    const audioRef = useRef<HTMLAudioElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);

    // Store health callbacks ref so they can be called throughout the connection lifecycle
    const healthCallbacksRef = useRef<WebRTCHealthCallbacks>({});

    const connect = useCallback(async (
        onMessage: (data: string, dataChannel: RTCDataChannel) => void,
        existingToken?: string,  // Optional token for session resumption
        healthCallbacks?: WebRTCHealthCallbacks  // Optional health monitoring callbacks
    ) => {
        // Store callbacks for use in event handlers
        if (healthCallbacks) {
            healthCallbacksRef.current = healthCallbacks;
        }
        setState(s => ({ ...s, connecting: true, error: null }));

        try {
            // Create peer connection with STUN servers for NAT traversal
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            });
            pcRef.current = pc;

            // Get user's microphone
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            streamRef.current = stream;

            // Add audio track to peer connection
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
                // Expose audio track for mute control
                if (track.kind === 'audio') {
                    healthCallbacksRef.current.onAudioTrack?.(track);
                }
            });

            // Create data channel for events
            const dataChannel = pc.createDataChannel('oai-events', {
                ordered: true
            });
            dataChannelRef.current = dataChannel;

            dataChannel.onopen = () => {
                console.log('[WebRTC] Data channel opened');
                setState(s => ({ ...s, dataChannelState: 'open' }));
                healthCallbacksRef.current.onDataChannelStateChange?.('open');
                
                // Configure session for voice (GA API)
                // Structure per OpenAI docs - nested under session.audio.input
                // 
                // IMPORTANT: semantic_vad cannot be used on initial WebRTC connection
                // We start with server_vad, then immediately update to semantic_vad
                // semantic_vad uses AI to understand when user has SEMANTICALLY finished speaking
                // (not just silence-based), which allows the model to stay silent during side conversations
                const sessionUpdate = {
                    type: 'session.update',
                    session: {
                        type: 'realtime',
                        audio: {
                            input: {
                                // Noise reduction to filter out background music/sounds
                                noise_reduction: {
                                    type: 'near_field'
                                },
                                // Enable input audio transcription
                                // Note: gpt-4o-transcribe-diarize requires org access, using standard model
                                transcription: {
                                    model: 'gpt-4o-transcribe',
                                    language: 'en'  // Lock to English to avoid music being interpreted as other languages
                                },
                                // Start with server_vad (required for initial WebRTC connection)
                                turn_detection: {
                                    type: 'server_vad',
                                    threshold: 0.5,
                                    prefix_padding_ms: 300,
                                    silence_duration_ms: 500
                                }
                            }
                        }
                    }
                };
                
                dataChannel.send(JSON.stringify(sessionUpdate));
                console.log('Sent initial session.update for voice configuration:', JSON.stringify(sessionUpdate));
                
                // Upgrade to semantic_vad with create_response: false
                // This gives US control over when to trigger responses
                // We call response.create manually after transcription, tool results, etc.
                // The MODEL then decides (via instructions) how much to say
                const semanticVadUpdate = {
                    type: 'session.update',
                    session: {
                        type: 'realtime',
                        audio: {
                            input: {
                                turn_detection: {
                                    type: 'semantic_vad',
                                    eagerness: 'low',  // Patient - waits longer for user to finish
                                    create_response: false,  // WE control when to trigger responses
                                    interrupt_response: true  // Allow user to interrupt
                                }
                            }
                        }
                    }
                };
                
                // Small delay to ensure first update is processed
                setTimeout(() => {
                    if (dataChannel.readyState === 'open') {
                        dataChannel.send(JSON.stringify(semanticVadUpdate));
                        console.log('Upgraded to semantic_vad:', JSON.stringify(semanticVadUpdate));
                    }
                }, 100);
            };

            dataChannel.onmessage = (e) => {
                // Track event for health monitoring
                try {
                    const parsed = JSON.parse(e.data);
                    healthCallbacksRef.current.onEvent?.(parsed.type || 'unknown');
                } catch {
                    healthCallbacksRef.current.onEvent?.('raw_data');
                }
                onMessage(e.data, dataChannel);
            };

            dataChannel.onerror = (e) => {
                console.error('[WebRTC] Data channel error:', e);
                setState(s => ({ ...s, error: 'Data channel error' }));
            };

            dataChannel.onclose = () => {
                console.warn('[WebRTC] Data channel closed');
                setState(s => ({ 
                    ...s, 
                    dataChannelState: 'closed',
                    connected: false,
                    error: 'Data channel closed - session may have timed out'
                }));
                healthCallbacksRef.current.onDataChannelStateChange?.('closed');
                healthCallbacksRef.current.onDisconnect?.('data_channel_closed');
            };

            // Handle incoming data channels from server
            pc.ondatachannel = (event) => {
                const channel = event.channel;
                console.log('Received data channel:', channel.label);

                channel.onmessage = (e) => {
                    onMessage(e.data, channel);
                };
            };

            // Track previous states to avoid duplicate logs
            let lastConnectionState = 'new';
            let lastIceState = 'new';

            // Monitor connection state for debugging and auto-reconnect
            pc.onconnectionstatechange = () => {
                const newState = pc.connectionState;
                // Only log actual state changes
                if (newState !== lastConnectionState) {
                    console.log('[WebRTC] Connection state:', newState);
                    lastConnectionState = newState;
                }
                setState(s => ({ ...s, connectionState: newState }));
                healthCallbacksRef.current.onConnectionStateChange?.(newState);
                
                if (newState === 'disconnected') {
                    // Don't log warning for every disconnected state - it's often transient
                } else if (newState === 'failed') {
                    console.error('[WebRTC] Connection failed');
                    setState(s => ({ 
                        ...s, 
                        connected: false, 
                        error: 'WebRTC connection failed - please reconnect'
                    }));
                    healthCallbacksRef.current.onDisconnect?.('connection_failed');
                } else if (newState === 'closed') {
                    setState(s => ({ ...s, connected: false }));
                }
            };

            pc.oniceconnectionstatechange = () => {
                const newIceState = pc.iceConnectionState;
                // Only log actual state changes
                if (newIceState !== lastIceState) {
                    console.log('[WebRTC] ICE state:', newIceState);
                    lastIceState = newIceState;
                }
                
                if (newIceState === 'disconnected') {
                    // Transient state, don't log warning
                } else if (newIceState === 'failed') {
                    console.error('[WebRTC] ICE connection failed');
                    setState(s => ({ 
                        ...s, 
                        connected: false, 
                        error: 'ICE connection failed - network issue'
                    }));
                    healthCallbacksRef.current.onDisconnect?.('ice_failed');
                }
            };

            // Handle incoming audio track
            pc.ontrack = (event) => {
                if (audioRef.current && event.streams[0]) {
                    audioRef.current.srcObject = event.streams[0];
                    audioRef.current.play().catch(err => {
                        console.error('Audio playback error:', err);
                    });
                }
            };

            // Create SDP offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            // Wait for ICE gathering to complete (or timeout)
            await waitForIceGathering(pc);

            // Use existing token (for resume) or create new session
            let ephemeralToken = existingToken;
            
            if (!ephemeralToken) {
                // Create session and get ephemeral token
                const sessionResponse = await fetch(`${BASE_URL}/session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ voice: 'ash' })
                });
                
                if (!sessionResponse.ok) {
                    throw new Error(`Session creation failed: ${sessionResponse.statusText}`);
                }

                const sessionData = await sessionResponse.json();
                ephemeralToken = sessionData.client_secret?.value;

                if (!ephemeralToken) {
                    throw new Error('No client secret in session response');
                }
            }

            // Exchange SDP with OpenAI via our server
            const sdpResponse = await fetch(`${BASE_URL}/sdp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sdp',
                    'Authorization': `Bearer ${ephemeralToken}`
                },
                body: pc.localDescription?.sdp
            });

            if (!sdpResponse.ok) {
                throw new Error(`SDP exchange failed: ${sdpResponse.statusText}`);
            }

            // Parse SDP answer
            const sdpText = await sdpResponse.text();
            let answerSdp: string;

            try {
                const jsonResponse = JSON.parse(sdpText);
                answerSdp = jsonResponse.sdp || jsonResponse.detail || sdpText;
            } catch {
                answerSdp = sdpText;
            }

            // Set remote description
            await pc.setRemoteDescription(new RTCSessionDescription({
                type: 'answer',
                sdp: answerSdp
            }));

            setState({ connected: true, connecting: false, error: null, connectionState: 'connected', dataChannelState: 'open' });
            console.log('[WebRTC] Connected successfully');
            console.log('[WebRTC] Session started at:', new Date().toISOString());

        } catch (err) {
            const error = err instanceof Error ? err.message : 'Connection failed';
            console.error('WebRTC connection error:', err);
            setState({ connected: false, connecting: false, error, connectionState: 'failed', dataChannelState: 'closed' });
            cleanup();
            throw err;
        }
    }, []);

    const disconnect = useCallback(() => {
        healthCallbacksRef.current.onDisconnect?.('user_initiated');
        cleanup();
        setState({ connected: false, connecting: false, error: null, connectionState: 'closed', dataChannelState: 'closed' });
        console.log('[WebRTC] Disconnected by user');
    }, []);

    const cleanup = () => {
        // Close data channel
        if (dataChannelRef.current) {
            dataChannelRef.current.close();
            dataChannelRef.current = null;
        }

        // Stop media tracks
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        // Close peer connection
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }

        // Stop audio playback
        if (audioRef.current) {
            audioRef.current.srcObject = null;
        }
    };

    const sendEvent = useCallback((event: object) => {
        if (dataChannelRef.current?.readyState === 'open') {
            dataChannelRef.current.send(JSON.stringify(event));
        } else {
            console.warn('Data channel not open, cannot send event');
        }
    }, []);

    /**
     * Inject conversation context for session resumption.
     * Sends conversation.item.create events for each context item,
     * plus a system message to help the model understand the context.
     */
    const injectContext = useCallback((contextItems: Array<{
        type: string;
        role: string;
        content: Array<{ type: string; text: string }>;
    }>) => {
        if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
            console.warn('Data channel not ready for context injection');
            return;
        }

        console.log('[WebRTC] Injecting context:', contextItems.length, 'items');
        
        // First, inject each conversation item to build the history
        for (const item of contextItems) {
            const event = {
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: item.role,
                    content: item.content
                }
            };
            console.log('[WebRTC] Injecting item:', item.role, item.content[0]?.text?.substring(0, 50));
            dataChannelRef.current.send(JSON.stringify(event));
        }

        // Add a system-level instruction about the resumed conversation
        if (contextItems.length > 0) {
            // Build a summary of what was discussed
            const userMessages = contextItems
                .filter(item => item.role === 'user')
                .map(item => item.content[0]?.text)
                .filter(Boolean);
            
            const summaryText = userMessages.length > 0 
                ? `This is a resumed conversation. The user previously discussed: ${userMessages.slice(-3).join('; ')}. Continue the conversation naturally, remembering what was discussed before.`
                : 'This is a resumed conversation. Continue naturally from where we left off.';

            // Send as a user message that sets context
            const contextSetupEvent = {
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [{ type: 'input_text', text: `[SYSTEM: ${summaryText}]` }]
                }
            };
            dataChannelRef.current.send(JSON.stringify(contextSetupEvent));
            console.log('[WebRTC] Sent context summary message');
        }

        console.log('[WebRTC] Context injection complete');
    }, []);

    return {
        connected: state.connected,
        connecting: state.connecting,
        error: state.error,
        connectionState: state.connectionState,
        dataChannelState: state.dataChannelState,
        audioRef,
        peerConnection: pcRef.current,
        dataChannel: dataChannelRef.current,
        connect,
        disconnect,
        sendEvent,
        injectContext
    };
};

/**
 * Wait for ICE gathering to complete or timeout.
 */
async function waitForIceGathering(
    pc: RTCPeerConnection,
    timeout: number = 2000
): Promise<void> {
    if (pc.iceGatheringState === 'complete') {
        return;
    }

    return new Promise((resolve) => {
        const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
                resolve();
            }
        };

        pc.onicegatheringstatechange = checkState;

        // Timeout fallback
        setTimeout(resolve, timeout);
    });
}

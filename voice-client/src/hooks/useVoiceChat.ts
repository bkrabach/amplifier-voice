// hooks/useVoiceChat.ts
import { useWebRTC } from './useWebRTC';
import { useChatMessages } from './useChatMessages';
import { VoiceChatEvent } from '../models/VoiceChatEvent';
import { useTranscriptStore } from '../stores/transcriptStore';

export const useVoiceChat = () => {
    const { connected, audioRef, connect, disconnect, injectContext } = useWebRTC();
    const { messages, handleEvent, clearMessages, loadPreviousMessages } = useChatMessages();
    const { 
        sessionId, 
        createSession, 
        resumeSession, 
        syncToServer,
        clearSession 
    } = useTranscriptStore();

    const startVoiceChat = async () => {
        try {
            // Create a new session for transcript tracking
            const newSessionId = await createSession();
            console.log('[VoiceChat] Created session:', newSessionId);
            
            await connect((data: string, dataChannel: RTCDataChannel) => {
                try {
                    const event = JSON.parse(data) as VoiceChatEvent;
                    handleEvent(event, dataChannel);
                } catch (err) {
                    console.debug('Error parsing event:', err);
                }
            });
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
                resumeData.realtime.client_secret.value
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
        disconnect();
    };

    return {
        connected,
        transcripts: messages,
        audioRef,
        sessionId,
        startVoiceChat,
        resumeVoiceChat,
        disconnectVoiceChat,
        clearMessages,
        clearSession
    };
};

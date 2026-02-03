/**
 * Chat messages hook for managing voice conversation state.
 *
 * Handles:
 * - User transcription messages
 * - Assistant response streaming
 * - Tool execution via Amplifier
 * - Voice event processing
 */

import { useRef, useState, useCallback } from 'react';
import { Message } from '../models/Message';
import { VoiceChatEvent, VoiceChatEventType } from '../models/VoiceChatEvent';
import { ToolCall, AmplifierToolResult } from '../models/ToolCall';
import { useTranscriptStore } from '../stores/transcriptStore';

const BASE_URL = 'http://127.0.0.1:8080';

// Track consecutive server failures to reduce console noise
let consecutiveServerErrors = 0;
const LOG_EVERY_N_ERRORS = 5; // Only log every 5th error to reduce noise

// Tool name to friendly display name
const getFriendlyToolName = (toolName: string, toolArgs?: Record<string, unknown> | string): string => {
    const friendlyNames: Record<string, string> = {
        'bash': 'command line',
        'filesystem': 'file system',
        'read_file': 'reading file',
        'write_file': 'writing file',
        'list_directory': 'listing directory',
        'execute': 'running command',
        'web': 'web browser',
        'search': 'web search',
        'fetch': 'fetching URL',
    };

    // Special handling for delegate tool - extract agent name
    if (toolName === 'delegate' && toolArgs) {
        try {
            // Handle both string (JSON) and object arguments
            const args = typeof toolArgs === 'string' ? JSON.parse(toolArgs) : toolArgs;
            if (args.agent) {
                // Extract friendly agent name from "foundation:explorer" -> "explorer"
                const agentParts = (args.agent as string).split(':');
                const agentName = agentParts[agentParts.length - 1]
                    .replace(/-/g, ' ')
                    .replace(/_/g, ' ');
                return agentName;
            }
        } catch {
            // Fall through to default handling
        }
    }

    // Exact match
    if (friendlyNames[toolName]) {
        return friendlyNames[toolName];
    }

    // Partial match
    for (const [key, friendly] of Object.entries(friendlyNames)) {
        if (toolName.toLowerCase().includes(key)) {
            return friendly;
        }
    }

    // Default: make readable
    return toolName.replace(/_/g, ' ').replace(/-/g, ' ');
};

export interface UseChatMessagesOptions {
    /**
     * Callback to check if auto-response is allowed.
     * When returns false, transcription won't automatically trigger response.create.
     * Used for mute and listen modes.
     */
    shouldAutoRespond?: () => boolean;
}

export const useChatMessages = (options: UseChatMessagesOptions = {}) => {
    const { shouldAutoRespond } = options;
    
    const [messages, setMessages] = useState<Message[]>([]);
    const activeUserMessageRef = useRef<string | null>(null);
    const activeAssistantMessageRef = useRef<Message | null>(null);
    const activeToolCallRef = useRef<ToolCall | null>(null);
    const dataChannelRef = useRef<RTCDataChannel | null>(null);
    
    // Async tool result handling - track response state and queue late-arriving results
    // This solves the issue where tool results arrive while the model is already speaking
    const responseInProgressRef = useRef<boolean>(false);
    const pendingToolAnnouncementsRef = useRef<Array<{ toolName: string; callId: string }>>([]);
    
    // Transcript capture
    const { addEntry: addTranscriptEntry } = useTranscriptStore();

    /**
     * Load previous transcript entries as messages for resumed sessions.
     * Called when resuming a session to show chat history in UI.
     */
    const loadPreviousMessages = useCallback((transcript: Array<{
        entry_type: string;
        text?: string;
        tool_name?: string;
        timestamp?: string;
    }>) => {
        const loadedMessages: Message[] = transcript
            .filter(entry => entry.text && (entry.entry_type === 'user' || entry.entry_type === 'assistant'))
            .map(entry => ({
                sender: entry.entry_type as 'user' | 'assistant',
                text: entry.text || '',
                timestamp: entry.timestamp ? new Date(entry.timestamp).getTime() : Date.now(),
                isStreaming: false,
                isHistory: true  // Mark as historical message
            }));
        
        console.log('[ChatMessages] Loaded', loadedMessages.length, 'previous messages');
        setMessages(loadedMessages);
    }, []);

    const sendToAssistant = useCallback((event: unknown) => {
        if (dataChannelRef.current?.readyState === 'open') {
            dataChannelRef.current.send(JSON.stringify(event));
        } else {
            console.warn('Data channel not ready');
        }
    }, []);

    /**
     * Flush pending tool announcements after response.done.
     * This triggers the model to speak about tool results that arrived while it was busy.
     */
    const flushPendingAnnouncements = useCallback(() => {
        if (pendingToolAnnouncementsRef.current.length === 0) return;
        
        const tools = pendingToolAnnouncementsRef.current.map(p => p.toolName).join(', ');
        const count = pendingToolAnnouncementsRef.current.length;
        console.log(`[ChatMessages] Flushing ${count} pending tool announcements: ${tools}`);
        pendingToolAnnouncementsRef.current = [];
        
        // Trigger model to speak about the completed tools
        sendToAssistant({
            type: 'response.create',
            response: {
                instructions: `The ${tools} task(s) completed while you were speaking. Please report those results now briefly.`
            }
        });
        responseInProgressRef.current = true;
    }, [sendToAssistant]);

    const executeToolCall = useCallback(async (toolCall: ToolCall) => {
        console.log('Executing tool via Amplifier:', toolCall.name);

        // Show executing status - use toolCall.id to uniquely identify this specific call
        const statusMessage: Message = {
            sender: 'system',
            text: `Delegating to ${getFriendlyToolName(toolCall.name, toolCall.arguments)}...`,
            timestamp: Date.now(),
            isSystem: true,
            type: 'tool_status',
            toolName: toolCall.name,
            toolCallId: toolCall.id,  // Unique ID to distinguish multiple calls to same tool
            toolStatus: 'executing'
        };
        setMessages(prev => [...prev, statusMessage]);

        try {
            const response = await fetch(`${BASE_URL}/execute/${toolCall.name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(toolCall.arguments),
            });

            if (!response.ok) {
                throw new Error(`Tool execution failed: ${response.statusText}`);
            }

            const result = await response.json() as AmplifierToolResult;
            
            // Reset error counter on successful call
            if (consecutiveServerErrors > 0) {
                console.log('[ChatMessages] Server connection restored');
                consecutiveServerErrors = 0;
            }

            // Update status message - match by toolCallId to only update THIS specific call
            setMessages(prev => prev.map(msg =>
                msg.type === 'tool_status' && msg.toolCallId === toolCall.id && msg.toolStatus === 'executing'
                    ? {
                        ...msg,
                        text: result.success
                            ? `Completed ${getFriendlyToolName(toolCall.name, toolCall.arguments)}`
                            : `Error with ${getFriendlyToolName(toolCall.name, toolCall.arguments)}`,
                        toolStatus: result.success ? 'completed' : 'error',
                        isError: !result.success
                    }
                    : msg
            ));

            // Format output for assistant
            const output = result.success
                ? (typeof result.output === 'string' ? result.output : JSON.stringify(result.output))
                : JSON.stringify({ error: result.error || 'Unknown error' });

            // Send result to assistant - always inject the result into conversation
            sendToAssistant({
                type: 'conversation.item.create',
                item: {
                    type: 'function_call_output',
                    call_id: toolCall.id,
                    output
                }
            });

            // Trigger response OR queue for later announcement
            // This handles the case where a tool result arrives while the model is speaking
            if (!responseInProgressRef.current) {
                // No active response - trigger immediately
                console.log(`[ChatMessages] Triggering response for ${toolCall.name} (no response in progress)`);
                sendToAssistant({
                    type: 'response.create'
                });
                responseInProgressRef.current = true;
            } else {
                // Response in progress - queue this for announcement after response.done
                console.log(`[ChatMessages] Queueing ${toolCall.name} result - model busy speaking`);
                pendingToolAnnouncementsRef.current.push({ 
                    toolName: getFriendlyToolName(toolCall.name, toolCall.arguments), 
                    callId: toolCall.id 
                });
            }

            return result;

        } catch (err) {
            const error = err instanceof Error ? err.message : 'Unknown error';
            const isServerError = error.includes('Failed to fetch') || 
                                  error.includes('NetworkError') ||
                                  error.includes('fetch');
            
            if (isServerError) {
                consecutiveServerErrors++;
                // Only log periodically when server is down to avoid console flood
                if (consecutiveServerErrors === 1) {
                    console.warn('[ChatMessages] Server unreachable - tool calls will fail');
                } else if (consecutiveServerErrors % LOG_EVERY_N_ERRORS === 0) {
                    console.warn(`[ChatMessages] Server still unreachable (${consecutiveServerErrors} failed calls)`);
                }
            } else {
                // Non-server errors always get logged
                consecutiveServerErrors = 0;
                console.error('Tool execution error:', error);
            }

            // Update status to error - match by toolCallId to only update THIS specific call
            setMessages(prev => prev.map(msg =>
                msg.type === 'tool_status' && msg.toolCallId === toolCall.id && msg.toolStatus === 'executing'
                    ? { ...msg, text: `Error: ${error}`, toolStatus: 'error', isError: true }
                    : msg
            ));

            // Send error to assistant
            sendToAssistant({
                type: 'conversation.item.create',
                item: {
                    type: 'function_call_output',
                    call_id: toolCall.id,
                    output: JSON.stringify({ error })
                }
            });

            // Trigger response OR queue (same logic as success path)
            if (!responseInProgressRef.current) {
                sendToAssistant({
                    type: 'response.create'
                });
                responseInProgressRef.current = true;
            } else {
                pendingToolAnnouncementsRef.current.push({ 
                    toolName: getFriendlyToolName(toolCall.name, toolCall.arguments), 
                    callId: toolCall.id 
                });
            }

            throw err;
        }
    }, [sendToAssistant]);

    const handleEvent = useCallback(async (event: VoiceChatEvent, rtcDataChannel?: RTCDataChannel) => {
        // Store data channel reference
        if (rtcDataChannel) {
            dataChannelRef.current = rtcDataChannel;
        }

        // Debug logging - log ALL events to see what OpenAI is sending
        const eventTypesOfInterest = [
            'conversation.item.input_audio_transcription',
            'input_audio_buffer',
            'response.output',
            'response.audio',
            'error'
        ];
        if (eventTypesOfInterest.some(t => event.type.includes(t))) {
            console.log('[ChatMessages] Event:', event.type, event.transcript ? `transcript: "${event.transcript.substring(0, 50)}..."` : '');
        }
        
        // Log FULL error events - critical for debugging!
        if (event.type === 'error') {
            console.error('[ChatMessages] ERROR from OpenAI:', JSON.stringify(event, null, 2));
        }

        switch (event.type) {
            // Response lifecycle events - critical for async tool handling
            case 'response.created':
                // Model is starting a response - track state
                responseInProgressRef.current = true;
                console.log('[ChatMessages] Response started - blocking new response.create');
                break;

            case 'response.done':
                // Model finished responding - flush any queued tool announcements
                responseInProgressRef.current = false;
                console.log('[ChatMessages] Response done - checking for pending announcements');
                // Use setTimeout to avoid race conditions with tool results arriving
                setTimeout(() => {
                    if (pendingToolAnnouncementsRef.current.length > 0) {
                        flushPendingAnnouncements();
                    }
                }, 100);
                break;

            // User speech events
            case VoiceChatEventType.SPEECH_STARTED:
                if (!activeUserMessageRef.current) {
                    activeUserMessageRef.current = event.item_id || 'temp-id';
                    setMessages(prev => [...prev, {
                        sender: 'user',
                        text: '',
                        timestamp: Date.now(),
                        isStreaming: true
                    }]);
                }
                break;

            case VoiceChatEventType.TRANSCRIPTION_COMPLETED:
                if (activeUserMessageRef.current && event.transcript) {
                    const userText = event.transcript.trim();
                    setMessages(prev => prev.map(msg =>
                        msg.isStreaming && msg.sender === 'user'
                            ? { ...msg, text: userText, isStreaming: false }
                            : msg
                    ));
                    activeUserMessageRef.current = null;
                    
                    // Capture to transcript
                    addTranscriptEntry({
                        entry_type: 'user',
                        text: userText,
                        audio_duration_ms: event.audio_end_ms && event.audio_start_ms 
                            ? event.audio_end_ms - event.audio_start_ms 
                            : undefined,
                    });
                    
                    // With create_response: false, we manually trigger response
                    // The MODEL decides (via instructions) how much to say
                    // BUT check if auto-respond is allowed (mute/listen mode may disable)
                    const autoRespondAllowed = shouldAutoRespond ? shouldAutoRespond() : true;
                    if (dataChannelRef.current?.readyState === 'open' && autoRespondAllowed) {
                        console.log('[ChatMessages] Triggering response.create - model decides how to respond');
                        dataChannelRef.current.send(JSON.stringify({ type: 'response.create' }));
                    } else if (!autoRespondAllowed) {
                        console.log('[ChatMessages] Auto-respond blocked (muted or replies paused)');
                    }
                }
                break;

            // Tool call events
            case VoiceChatEventType.FUNCTION_CALL:
                if (event.delta && event.call_id) {
                    if (!activeToolCallRef.current) {
                        activeToolCallRef.current = {
                            id: event.call_id,
                            name: event.name || '',
                            arguments: {},
                            status: 'pending'
                        };
                    }
                    try {
                        const partial = JSON.parse(event.delta);
                        activeToolCallRef.current.arguments = {
                            ...activeToolCallRef.current.arguments,
                            ...partial
                        };
                    } catch {
                        // Ignore partial JSON
                    }
                }
                break;

            case VoiceChatEventType.FUNCTION_CALL_DONE:
                if (event.call_id && event.name) {
                    try {
                        const toolArgs = event.arguments ? JSON.parse(event.arguments) : {};
                        const toolCall: ToolCall = {
                            id: event.call_id,
                            name: event.name,
                            arguments: toolArgs,
                            status: 'pending'
                        };
                        
                        // Capture tool call to transcript
                        addTranscriptEntry({
                            entry_type: 'tool_call',
                            tool_name: event.name,
                            tool_call_id: event.call_id,
                            tool_arguments: toolArgs,
                        });
                        
                        const result = await executeToolCall(toolCall);
                        
                        // Capture tool result to transcript
                        addTranscriptEntry({
                            entry_type: 'tool_result',
                            tool_name: event.name,
                            tool_call_id: event.call_id,
                            tool_result: result as unknown as Record<string, unknown>,
                        });
                    } catch (error) {
                        console.error('Tool execution failed:', error);
                        // Capture error to transcript
                        addTranscriptEntry({
                            entry_type: 'tool_result',
                            tool_name: event.name,
                            tool_call_id: event.call_id,
                            tool_result: { error: error instanceof Error ? error.message : 'Unknown error' },
                        });
                    }
                    activeToolCallRef.current = null;
                }
                break;

            // Assistant response events - handle BOTH text and audio transcript events
            // For voice responses, OpenAI sends response.output_audio_transcript.delta/done
            // For text responses, OpenAI sends response.output_text.delta/done
            case VoiceChatEventType.ASSISTANT_DELTA:
            case VoiceChatEventType.ASSISTANT_AUDIO_DELTA:
                if (event.delta) {
                    if (!activeAssistantMessageRef.current) {
                        const newMsg: Message = {
                            sender: 'assistant',
                            text: event.delta,
                            timestamp: Date.now(),
                            isStreaming: true
                        };
                        activeAssistantMessageRef.current = newMsg;
                        setMessages(prev => [...prev, newMsg]);
                    } else {
                        activeAssistantMessageRef.current = {
                            ...activeAssistantMessageRef.current,
                            text: activeAssistantMessageRef.current.text + event.delta,
                            timestamp: Date.now()
                        };
                        setMessages(prev => prev.map(msg =>
                            msg.isStreaming && msg.sender === 'assistant'
                                ? { ...activeAssistantMessageRef.current! }
                                : msg
                        ));
                    }
                }
                break;

            case VoiceChatEventType.ASSISTANT_DONE:
            case VoiceChatEventType.ASSISTANT_AUDIO_DONE:
                if (activeAssistantMessageRef.current) {
                    const assistantText = event.transcript || activeAssistantMessageRef.current.text;
                    const finalMsg: Message = {
                        sender: 'assistant',
                        text: assistantText,
                        timestamp: Date.now(),
                        isStreaming: false
                    };
                    setMessages(prev => prev.map(msg =>
                        msg.isStreaming && msg.sender === 'assistant' ? finalMsg : msg
                    ));
                    activeAssistantMessageRef.current = null;
                    
                    // Capture to transcript
                    if (assistantText) {
                        addTranscriptEntry({
                            entry_type: 'assistant',
                            text: assistantText,
                        });
                    }
                }
                break;

            // Amplifier voice events
            case VoiceChatEventType.VOICE_TOOL_START:
                if (event.data) {
                    const data = event.data;
                    const toolName = data.tool_name || 'unknown';
                    setMessages(prev => [...prev, {
                        sender: 'system',
                        text: data.spoken_text || `Using ${getFriendlyToolName(toolName)}`,
                        timestamp: Date.now(),
                        isSystem: true,
                        type: 'tool_status',
                        toolName,
                        toolStatus: 'executing'
                    }]);
                }
                break;

            case VoiceChatEventType.VOICE_TOOL_COMPLETE:
                if (event.data) {
                    const data = event.data;
                    const toolName = data.tool_name || 'unknown';
                    const success = data.success !== false;
                    const spokenText = data.spoken_text;
                    setMessages(prev => prev.map(msg =>
                        msg.type === 'tool_status' && msg.toolName === toolName && msg.toolStatus === 'executing'
                            ? {
                                ...msg,
                                text: spokenText || (success ? 'Done' : 'Completed with issues'),
                                toolStatus: success ? 'completed' : 'error',
                                isError: !success
                            }
                            : msg
                    ));
                }
                break;

            case VoiceChatEventType.VOICE_TOOL_ERROR:
                if (event.data) {
                    const data = event.data;
                    const toolName = data.tool_name || 'unknown';
                    const errorText = data.spoken_text || data.error || 'An error occurred';
                    setMessages(prev => prev.map(msg =>
                        msg.type === 'tool_status' && msg.toolName === toolName && msg.toolStatus === 'executing'
                            ? {
                                ...msg,
                                text: errorText,
                                toolStatus: 'error',
                                isError: true
                            }
                            : msg
                    ));
                }
                break;

            case VoiceChatEventType.VOICE_DISPLAY:
                if (event.data?.message) {
                    const data = event.data;
                    const displayText = data.spoken_text || data.message || '';
                    const displayLevel = data.level || 'info';
                    setMessages(prev => [...prev, {
                        sender: 'system',
                        text: displayText,
                        timestamp: Date.now(),
                        isSystem: true,
                        type: 'display',
                        displayLevel,
                        isError: displayLevel === 'error'
                    }]);
                }
                break;
        }
    }, [executeToolCall]);

    const clearMessages = useCallback(() => {
        setMessages([]);
        activeUserMessageRef.current = null;
        activeAssistantMessageRef.current = null;
        activeToolCallRef.current = null;
    }, []);

    // Add a system message (for visual indicators like pause/resume)
    const addSystemMessage = useCallback((text: string, icon?: string) => {
        const message: Message = {
            sender: 'system',
            text: icon ? `${icon} ${text}` : text,
            timestamp: new Date().toISOString(),
        };
        setMessages(prev => [...prev, message]);
    }, []);

    return {
        messages,
        handleEvent,
        clearMessages,
        loadPreviousMessages,
        addSystemMessage
    };
};

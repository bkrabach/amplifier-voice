// models/VoiceChatEvent.ts

export enum VoiceChatEventType {
    // OpenAI Realtime API (GA) events
    SPEECH_STARTED = 'input_audio_buffer.speech_started',
    SPEECH_STOPPED = 'input_audio_buffer.speech_stopped',
    TRANSCRIPTION_COMPLETED = 'conversation.item.input_audio_transcription.completed',
    
    // Text output events (for text-only responses)
    ASSISTANT_TEXT_DELTA = 'response.output_text.delta',
    ASSISTANT_TEXT_DONE = 'response.output_text.done',
    
    // Audio transcript events (for voice responses - THIS IS THE KEY!)
    ASSISTANT_AUDIO_DELTA = 'response.output_audio_transcript.delta',
    ASSISTANT_AUDIO_DONE = 'response.output_audio_transcript.done',
    
    // Legacy aliases for compatibility
    ASSISTANT_DELTA = 'response.output_text.delta',
    ASSISTANT_DONE = 'response.output_text.done',
    
    // Function call events (unchanged in GA)
    FUNCTION_CALL = 'response.function_call_arguments.delta',
    FUNCTION_CALL_DONE = 'response.function_call_arguments.done',

    // Amplifier-specific events (voice protocol adapters)
    VOICE_TOOL_START = 'voice_tool_start',
    VOICE_TOOL_COMPLETE = 'voice_tool_complete',
    VOICE_TOOL_ERROR = 'voice_tool_error',
    VOICE_CONTENT_DELTA = 'voice_content_delta',
    VOICE_CONTENT_COMPLETE = 'voice_content_complete',
    VOICE_DISPLAY = 'voice_display',
}

export interface VoiceChatEvent {
    type: string;
    transcript?: string;
    delta?: string;
    timestamp?: number;
    audio_start_ms?: number;
    audio_end_ms?: number;
    item_id?: string;
    call_id?: string;
    arguments?: string;
    name?: string;
    function_name?: string;

    // Amplifier event data
    data?: {
        tool_name?: string;
        call_id?: string;
        spoken_text?: string;
        success?: boolean;
        error?: string;
        level?: 'info' | 'warning' | 'error' | 'success';
        message?: string;
        delta?: string;
        content?: string;
        index?: number;
    };
}

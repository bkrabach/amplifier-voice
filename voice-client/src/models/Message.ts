// models/Message.ts

export type MessageSender = 'user' | 'assistant' | 'system';

export type MessageType = 'text' | 'tool_status' | 'display';

export interface Message {
    sender: 'user' | 'assistant' | 'system';
    text: string;
    timestamp?: number;
    isStreaming?: boolean;
    isSystem?: boolean;
    isError?: boolean;

    // Extended message properties for Amplifier integration
    type?: MessageType;
    toolName?: string;       // For tool status messages
    toolStatus?: 'executing' | 'completed' | 'error';
    displayLevel?: 'info' | 'warning' | 'error' | 'success';
}

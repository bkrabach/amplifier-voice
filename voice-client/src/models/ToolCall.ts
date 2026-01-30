export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
    status: 'pending' | 'executing' | 'completed' | 'error';
    result?: unknown;
    error?: string;
    startTime?: number;
    endTime?: number;
    spokenText?: string;  // Voice-friendly status text from Amplifier
}

export interface Tool {
    type: 'function';
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, unknown>;
        required: string[];
    };
}

export interface AmplifierToolResult {
    success: boolean;
    output?: unknown;
    error?: string;
}

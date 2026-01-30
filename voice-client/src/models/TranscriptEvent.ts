// models/TranscriptEvent.ts

export interface TranscriptEvent {
    type: string;
    transcript?: string;
    timestamp?: number;
    event_id?: string;
    response_id?: string;
    item_id?: string;
    delta?: string;
}

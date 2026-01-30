// utils/transcriptParser.ts
import { Message } from '../models/Message';
import { TranscriptEvent } from '../models/TranscriptEvent';

const parseTranscripts = (events: string): Message[] => {
    const messages: Message[] = [];
    let currentMessage: Partial<Message> = {};

    events.split('\n').forEach(line => {
        if (!line.trim()) return;

        try {
            const event: TranscriptEvent = JSON.parse(line);

            // Handle user messages
            if (event.type === 'conversation.item.input_audio_transcription.completed' && event.transcript?.trim()) {
                messages.push({
                    sender: 'user',
                    text: event.transcript.trim(),
                    timestamp: event.timestamp
                });
            }

            // Handle assistant responses - accumulate deltas for a complete message
            // GA API uses output_text instead of audio_transcript
            if (event.type === 'response.output_text.delta' && event.delta) {
                if (!currentMessage.sender) {
                    currentMessage = {
                        sender: 'assistant',
                        text: event.delta,
                        timestamp: event.timestamp
                    };
                } else {
                    currentMessage.text += event.delta;
                }
            }

            // When the assistant message is complete, add it to messages
            if (event.type === 'response.output_text.done' && currentMessage.text) {
                messages.push({
                    sender: 'assistant',
                    text: currentMessage.text.trim(),
                    timestamp: event.timestamp
                } as Message);
                currentMessage = {};
            }
        } catch (error) {
            // Skip invalid JSON lines
            console.debug('Error parsing event:', error);
            return;
        }
    });

    return messages;
};

export { parseTranscripts };

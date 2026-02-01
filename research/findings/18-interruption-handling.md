# Interruption Handling and Turn-Taking in Voice AI

## Research Summary

Interruption handling is critical for natural voice AI conversations. OpenAI's Realtime API provides built-in VAD-based interruption detection with `response.cancel` and `conversation.item.truncate` events for managing mid-response stops. Key challenges include distinguishing backchannels ("uh-huh") from true interrupts, maintaining accurate conversation history after truncation, and implementing graceful resume strategies.

---

## 1. Barge-in Detection

### How OpenAI Realtime API Detects Interruptions

The Realtime API uses **server-side Voice Activity Detection (VAD)** to detect when the user starts speaking during AI output:

```
When user speaks → VAD detects → input_audio_buffer.speech_started event
                              → Any in-progress response is cancelled
                              → Audio output is flushed
```

**Key Events:**
- `input_audio_buffer.speech_started` - User began speaking
- `input_audio_buffer.speech_stopped` - User stopped speaking
- `conversation.interrupted` - Model output was interrupted by user speech

### VAD Configuration Parameters

```javascript
{
  "turn_detection": {
    "type": "server_vad",  // or "semantic_vad" for smarter detection
    "threshold": 0.5,      // 0.0-1.0, higher = less sensitive
    "prefix_padding_ms": 300,  // Audio to include before speech detected
    "silence_duration_ms": 500, // How long to wait after silence
    "interrupt_response": true, // Auto-cancel ongoing response
    "create_response": true     // Auto-generate response after user stops
  }
}
```

### Semantic VAD (Newer Option)

OpenAI also offers **Semantic VAD** which uses a model to determine turn endings:

```javascript
{
  "turn_detection": {
    "type": "semantic_vad",
    "eagerness": "medium", // "low", "medium", "high", or "auto"
    "interrupt_response": true,
    "create_response": true
  }
}
```

- **Low eagerness**: Waits longer (up to 8s) - better for thoughtful users
- **High eagerness**: Responds quickly (up to 2s) - more interactive
- Handles "uhhm" and trailing speech better than simple VAD

**Source:** [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime-conversations)

---

## 2. Response Truncation

### The Two-Step Cancellation Process

When a user interrupts, you need BOTH events:

1. **`response.cancel`** - Stop generating the current response
2. **`conversation.item.truncate`** - Sync conversation history to what user actually heard

```javascript
// Step 1: Cancel the active response
dataChannel.send(JSON.stringify({
  type: "response.cancel"
}));

// Step 2: Truncate to what was actually played
dataChannel.send(JSON.stringify({
  type: "conversation.item.truncate",
  item_id: lastAudioMessageItemId,
  content_index: 0,
  audio_end_ms: millisecondsPlayed
}));
```

### Why Both Are Needed

| Event | Purpose |
|-------|---------|
| `response.cancel` | Stops generation immediately |
| `conversation.item.truncate` | Removes unheard audio/text from context |

**Critical Insight:** The model generates audio faster than real-time playback. If user heard 5 seconds but model generated 30 seconds, you must truncate to 5 seconds to maintain accurate conversation history.

**Source:** [WorkAdventure Blog](https://docs.workadventu.re/blog/realtime-api-interrupting-the-model/)

---

## 3. Context Accuracy with conversation.item.truncate

### The Audio Playback Tracking Problem

The server sends audio faster than it can be played. To truncate accurately, you must track:
- Which audio item is currently playing (`item_id`)
- How many samples/milliseconds have been played (`audio_end_ms`)

### Implementation Pattern (from WorkAdventure)

```javascript
let lastAudioMessageItemId = "";
let audioSampleCounter = 0;
let lastAudioMessageItemIdPlayed = "";
let audioSampleCounterPlayed = 0;

// Track what's been sent
realtimeClient.on('conversation.updated', (event) => {
  if (event.delta.audio) {
    if (event.item.id !== lastAudioMessageItemId) {
      audioSampleCounter = 0;
      lastAudioMessageItemId = event.item.id;
    }
    audioSampleCounter += event.delta.audio.length;
    
    // Track playback completion via AudioWorklet
    const constItemId = lastAudioMessageItemId;
    const constSampleCount = audioSampleCounter;
    
    outputPcmStreamer.appendPCMData(float32Array).then(() => {
      lastAudioMessageItemIdPlayed = constItemId;
      audioSampleCounterPlayed = constSampleCount;
    });
  }
});

// On interruption, truncate to last played position
realtimeClient.on('conversation.interrupted', (event) => {
  if (lastAudioMessageItemIdPlayed) {
    realtimeClient.cancelResponse(
      lastAudioMessageItemIdPlayed, 
      audioSampleCounterPlayed
    );
  }
  outputPcmStreamer.resetAudioBuffer();
});
```

### Calculating audio_end_ms

```javascript
// From sample count to milliseconds (24kHz audio)
const audio_end_ms = Math.floor(audioSampleCounterPlayed / 24); // 24 samples per ms
```

### What Truncation Does

From OpenAI docs:
> "Truncating audio will delete the server-side text transcript to ensure there is not text in the context that hasn't been heard by the user."

**Important:** The transcript is also truncated, not just audio. This keeps text and audio in sync.

**Source:** [OpenAI API Reference](https://platform.openai.com/docs/api-reference/realtime-client-events/conversation/item/truncate)

---

## 4. Backchannel Detection

### The Problem

Current voice AI treats every user sound as an interruption:
- User says "uh-huh" (meaning "I'm listening, continue") 
- Bot stops dead, thinking it's been interrupted

### What is Backchanneling?

**Backchannels** are listener responses that signal engagement without taking the floor:
- "uh-huh", "yeah", "right", "I see"
- "go on", "okay", "mm-hmm"
- Non-verbal: nodding (in video)

### Academic Research

Research from backchannel prediction (Switchboard corpus) categorizes:
- **dialog-bc**: Backchannels in normal dialogue
- **monologuing-bc**: Backchannels during extended speaker turns
- **non-bc**: Actual turn-taking attempts

### Industry Approaches

**Retell AI's Backchanneling Feature:**
- AI agents use affirmations ("yeah", "I see") during user speech
- Creates sense of active listening
- Reduces awkward silences

**Yellow.ai's Context-Aware Interruption:**
- Evaluates "validity" of interruptions
- Valid interruption: Related to current context → respond
- Invalid interruption: Background noise/off-topic → ignore

```javascript
// Yellow.ai approach (conceptual)
{
  interject: true,
  interject_early: true,
  interjection_response: "no_action" // or "take_action"
}
```

### Distinguishing Strategies

| Signal | Likely Backchannel | Likely Interruption |
|--------|-------------------|---------------------|
| Duration | Very short (<500ms) | Longer utterance |
| Content | "uh-huh", "yeah" | New topic/question |
| Timing | During AI speech, brief | Sustained speaking |
| Context | Matches acknowledgment | Changes subject |

### Implementation Considerations

1. **Short utterance detection**: Don't interrupt for sub-500ms sounds
2. **Keyword filtering**: Recognize common backchannel words
3. **Semantic analysis**: Use LLM to classify intent
4. **Confidence thresholds**: Require sustained speech before interrupting

**Sources:** 
- [Retell AI Blog](https://www.retellai.com/blog/how-backchanneling-improves-user-experience-in-ai-powered-voice-agents)
- [HackerNoon - Interruption State Machine](https://hackernoon.com/stop-muting-your-users-building-a-pragmatic-interruption-state-machine-for-voice-ai)

---

## 5. Overlap Handling

### Full-Duplex Challenge

Voice is a **full-duplex channel** - both parties can speak simultaneously. Challenges:

1. **Echo cancellation**: Prevent AI hearing itself
2. **Source separation**: Distinguish user from AI audio
3. **Simultaneous processing**: Handle both streams

### WebRTC vs WebSocket Considerations

From Latent Space analysis:

| Aspect | WebRTC | WebSocket |
|--------|--------|-----------|
| Echo cancellation | Built-in, high quality | Manual implementation needed |
| Latency | Lower (UDP-based) | Higher (TCP head-of-line blocking) |
| Interruption logic | Auto timestamps | Manual tracking required |
| Noise reduction | Built-in AGC | Separate processing needed |

**Recommendation:** Use WebRTC for client-facing apps, WebSocket for server-to-server.

### Handling Simultaneous Speech

```javascript
// Pipecat approach: Track conversation state
const conversationState = {
  userSpeaking: false,
  aiSpeaking: false,
  pendingInterruption: false
};

// On user speech detected during AI output
if (conversationState.aiSpeaking && userSpeechDetected) {
  conversationState.pendingInterruption = true;
  
  // Don't immediately stop - wait for sustained speech
  setTimeout(() => {
    if (stillSpeaking) {
      cancelResponse();
    }
  }, 200); // 200ms debounce
}
```

**Source:** [Latent Space - Realtime API Manual](https://www.latent.space/p/realtime-api)

---

## 6. Resume Strategies

### After Interruption: What Now?

When user interrupts, several resume strategies exist:

### Strategy 1: Acknowledge and Continue

```
AI: "The weather today will be sunny with—"
User: "Wait, what about tomorrow?"
AI: "Tomorrow will be rainy. As I was saying about today, 
     it will be sunny with temperatures around 75 degrees."
```

**Implementation:** Store last context point, reference it after addressing interruption.

### Strategy 2: Fresh Start

Simply respond to the new query without referencing previous content.

```
AI: "The weather today will be sunny with—"  
User: "What about tomorrow?"
AI: "Tomorrow will be rainy with a high of 65."
```

### Strategy 3: Offer to Continue

```
AI: "The weather today will be sunny with—"
User: "Wait, what about tomorrow?"
AI: "Tomorrow will be rainy. Would you like me to continue 
     with today's forecast?"
```

### Implementation Pattern

```javascript
// Track truncation point for potential resume
let interruptionContext = {
  itemId: null,
  truncatedAt: null,
  wasCompleted: false,
  originalContent: null
};

realtimeClient.on('conversation.interrupted', (event) => {
  interruptionContext = {
    itemId: lastAudioMessageItemIdPlayed,
    truncatedAt: audioSampleCounterPlayed,
    wasCompleted: false,
    originalContent: getCurrentResponseText()
  };
});

// After handling user's interruption, optionally resume
function offerResume() {
  if (!interruptionContext.wasCompleted) {
    // Add to context: "I was explaining X. Should I continue?"
  }
}
```

### Prompt Engineering for Resume

Include in system prompt:
```
When interrupted:
1. Address the user's immediate concern first
2. If the interruption was a clarification, incorporate it
3. If you were mid-explanation, offer to continue: "Would you like me to finish explaining...?"
4. Never repeat content the user already heard
```

---

## 7. Best Practices Summary

### Configuration Recommendations

```javascript
const recommendedConfig = {
  turn_detection: {
    type: "semantic_vad",  // Better than server_vad for natural conversation
    eagerness: "medium",
    interrupt_response: true,
    create_response: true
  },
  // For server_vad fallback:
  // silence_duration_ms: 500-800 (longer for complex topics)
  // threshold: 0.5-0.7 (higher in noisy environments)
};
```

### Interruption Handling Checklist

- [ ] Track audio playback position accurately
- [ ] Send both `response.cancel` AND `conversation.item.truncate`
- [ ] Calculate `audio_end_ms` from actual playback, not sent audio
- [ ] Handle rapid successive interruptions gracefully
- [ ] Consider debouncing short sounds (backchannels)
- [ ] Provide clear audio feedback when interrupted
- [ ] Store context for potential resume

### Common Pitfalls

| Issue | Cause | Solution |
|-------|-------|----------|
| Context drift | Not truncating after interrupt | Always call `conversation.item.truncate` |
| Talking over user | Not canceling response | Send `response.cancel` immediately |
| Robotic feel | Treating all sounds as interrupts | Add backchannel detection |
| Lost context | Not tracking playback position | Use AudioWorklet callbacks |
| Echo/feedback | Poor audio processing | Use WebRTC or proper echo cancellation |

---

## 8. Architecture Patterns

### Pipecat Pipeline Approach

```python
# From Pipecat - handling interruption in a processing pipeline
pipeline = Pipeline([
    transport.input(),
    context_aggregator.user(),
    openai_realtime_llm,
    context_aggregator.assistant(),
    transport.output()
])

# Interruption handling happens at LLM service level
# See: pipecat/services/openai_realtime_beta/context.py
```

### State Machine Approach

```
States:
  IDLE → USER_SPEAKING → PROCESSING → AI_SPEAKING → IDLE
                                           ↓
                                    INTERRUPTED
                                           ↓
                              (handle, then back to USER_SPEAKING)
```

### Event Flow Diagram

```
User speaks during AI response:
  ┌─────────────────────────────────────────────────────────┐
  │ 1. input_audio_buffer.speech_started (from server)      │
  │ 2. Client sends response.cancel                          │
  │ 3. Server sends response.cancelled                       │
  │ 4. Client calculates audio_end_ms from playback tracker │
  │ 5. Client sends conversation.item.truncate              │
  │ 6. Server sends conversation.item.truncated             │
  │ 7. Continue processing user's new input                  │
  └─────────────────────────────────────────────────────────┘
```

---

## References

1. **OpenAI Realtime API Documentation**
   - [Realtime Conversations Guide](https://platform.openai.com/docs/guides/realtime-conversations)
   - [VAD Configuration](https://platform.openai.com/docs/guides/realtime-vad)
   - [API Reference - Client Events](https://platform.openai.com/docs/api-reference/realtime-client-events)

2. **WorkAdventure - Interrupting the Model**
   - https://docs.workadventu.re/blog/realtime-api-interrupting-the-model/
   - Detailed AudioWorklet implementation for tracking playback

3. **Latent Space - Realtime API Missing Manual**
   - https://www.latent.space/p/realtime-api
   - Comprehensive technical guide from Daily.co/Pipecat creators

4. **Pipecat Framework**
   - https://github.com/pipecat-ai/pipecat
   - Open-source voice AI framework with Realtime API support

5. **Retell AI - Backchanneling**
   - https://www.retellai.com/blog/how-backchanneling-improves-user-experience-in-ai-powered-voice-agents

6. **DeepWiki - Turn Detection**
   - https://deepwiki.com/openai/openai-realtime-api-beta/6.1-turn-detection

---

## Confidence Level

**High confidence** on:
- OpenAI Realtime API events and configuration
- Basic interruption handling patterns
- Audio truncation mechanics

**Medium confidence** on:
- Backchannel detection (limited production examples)
- Resume strategies (more art than science)
- Optimal VAD thresholds (environment-dependent)

**Gaps to investigate:**
- Production-scale backchannel classification
- Handling rapid-fire interruptions
- Multi-speaker scenarios
- Non-English language patterns for backchannels

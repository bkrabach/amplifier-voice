# VAD and Audio Settings for OpenAI Realtime API

## Research Summary

OpenAI's Realtime API provides three VAD (Voice Activity Detection) modes: `server_vad` (default), `semantic_vad` (newer, smarter), and `none` (manual control). Server VAD uses silence detection with configurable threshold, padding, and duration parameters. Semantic VAD uses an AI classifier to understand when users are semantically finished speaking. Audio is PCM16 at 24kHz for quality or G.711 (8kHz) for telephony, with 10 built-in voices available.

---

## 1. VAD Modes

### 1.1 Server VAD (`server_vad`)

The default mode using traditional voice activity detection based on audio energy levels and silence periods.

**Configuration:**
```json
{
  "turn_detection": {
    "type": "server_vad",
    "threshold": 0.5,
    "prefix_padding_ms": 300,
    "silence_duration_ms": 500,
    "create_response": true,
    "interrupt_response": true
  }
}
```

**Behavior:**
- Continuously monitors audio stream for speech
- Emits `input_audio_buffer.speech_started` when speech begins
- Emits `input_audio_buffer.speech_stopped` after silence threshold
- Automatically triggers response generation when speech ends
- Handles interruptions by canceling in-progress responses

### 1.2 Semantic VAD (`semantic_vad`)

Newer mode (introduced March 2025) that uses an AI classifier to semantically determine when the user has finished speaking.

**Configuration:**
```json
{
  "turn_detection": {
    "type": "semantic_vad",
    "eagerness": "medium",
    "create_response": true,
    "interrupt_response": true
  }
}
```

**Eagerness Settings:**
| Value | Behavior | Max Timeout |
|-------|----------|-------------|
| `low` | Lets users take their time speaking, waits longer | 8 seconds |
| `medium` | Balanced approach (default) | 4 seconds |
| `high` | Chunks audio as soon as possible, responds quickly | 2 seconds |
| `auto` | Equivalent to `medium` | 4 seconds |

**Important Limitations:**
- Cannot be used for initial WebRTC session creation
- Must first create session with `server_vad`, then update to `semantic_vad`
- Does NOT support threshold, prefix_padding_ms, or silence_duration_ms parameters

**Implementation Pattern:**
```python
# Initial session creation with server_vad
session_config = {
    "turn_detection": {"type": "server_vad"}
}

# Then update to semantic_vad
session_update = {
    "type": "session.update",
    "session": {
        "turn_detection": {
            "type": "semantic_vad",
            "eagerness": "medium",
            "create_response": True
        }
    }
}
```

### 1.3 Manual Mode (`none`)

Disables automatic turn detection, giving full control to the application.

**Configuration:**
```json
{
  "turn_detection": null
}
```

**Required Manual Events:**
1. `input_audio_buffer.append` - Send audio chunks
2. `input_audio_buffer.commit` - Signal end of user input
3. `response.create` - Trigger response generation

**Use Cases:**
- Push-to-talk interfaces
- Custom VAD implementations (e.g., Silero VAD)
- Applications requiring precise control over turn-taking

---

## 2. VAD Parameters (Server VAD Only)

### 2.1 Threshold (`threshold`)

**Range:** 0.0 to 1.0  
**Default:** 0.5

Sensitivity level for classifying audio as speech vs silence.

| Adjustment | Advantages | Disadvantages |
|------------|------------|---------------|
| **Increase** (0.7-0.9) | Reduces false positives in noisy environments | May miss quiet speech |
| **Decrease** (0.3-0.4) | Catches softer speech | Higher false positives from background noise |

**Recommendations:**
- Noisy environments: 0.6-0.8
- Quiet environments: 0.4-0.5
- Default (0.5) works well for most cases

### 2.2 Prefix Padding (`prefix_padding_ms`)

**Range:** 0 to ~1000ms  
**Default:** 300ms

Amount of audio captured BEFORE detected speech starts.

| Adjustment | Advantages | Disadvantages |
|------------|------------|---------------|
| **Increase** (400-500ms) | Captures beginning of utterances better | Slight processing delay |
| **Decrease** (100-200ms) | Lower latency | Risk of clipping initial phonemes |

**Recommendations:**
- Typical use: 300ms (default)
- Low-latency needs: 200ms
- Important transcription: 400ms

### 2.3 Silence Duration (`silence_duration_ms`)

**Range:** 200ms to several seconds  
**Default:** 500ms

How long to wait after speech stops before triggering response.

| Adjustment | Advantages | Disadvantages |
|------------|------------|---------------|
| **Increase** (800ms-1s) | Users can pause and think | Slower response time |
| **Decrease** (200-300ms) | Faster responses | May cut off incomplete thoughts |

**Recommendations by Use Case:**
- Quick demos/prototypes: 300-500ms
- Normal conversation: 500-600ms
- Job interviews/thoughtful responses: 800-1000ms
- **Never below 500ms in production** (per Pipecat team advice)

---

## 3. Turn Detection and Speech Events

### 3.1 Server Events

| Event | Description |
|-------|-------------|
| `input_audio_buffer.speech_started` | Speech detected in audio buffer |
| `input_audio_buffer.speech_stopped` | Silence detected, speech ended |
| `input_audio_buffer.committed` | Audio buffer committed for processing |
| `conversation.item.input_audio_transcription.completed` | Transcription of user speech ready |

### 3.2 Client Events

| Event | Description |
|-------|-------------|
| `input_audio_buffer.append` | Send audio chunk (base64 encoded) |
| `input_audio_buffer.commit` | Commit buffered audio for processing |
| `input_audio_buffer.clear` | Clear the audio buffer |
| `response.create` | Request response generation |
| `response.cancel` | Cancel in-progress response |
| `conversation.item.truncate` | Truncate assistant response (for interruptions) |

---

## 4. Interruption Handling

### 4.1 Automatic Interruption (with VAD enabled)

When `interrupt_response: true`:
1. User speech triggers `input_audio_buffer.speech_started`
2. Server automatically cancels in-progress response
3. Audio output is flushed
4. New response generated based on user's interruption

### 4.2 Manual Interruption Handling

For proper context synchronization after interruption:

```javascript
// When user interrupts, truncate the assistant's response
// to match only what the user actually heard
{
  "type": "conversation.item.truncate",
  "item_id": "last_assistant_response_id",
  "content_index": 0,
  "audio_end_ms": actualAudioPlayedMs  // How much audio user heard
}
```

**Critical:** You MUST send `conversation.item.truncate` to synchronize server context with what the user actually heard. This prevents the model from thinking it said more than was played.

### 4.3 Disabling Interruptions

For scenarios where AI should complete its response:
```json
{
  "turn_detection": {
    "type": "server_vad",
    "interrupt_response": false
  }
}
```

---

## 5. Audio Formats

### 5.1 Input Audio Formats

| Format | Sample Rate | Use Case |
|--------|-------------|----------|
| `pcm16` | 24kHz | Default, highest quality |
| `g711_ulaw` | 8kHz | US telephony (T1) |
| `g711_alaw` | 8kHz | International telephony (E1) |

### 5.2 Output Audio Formats

Same formats supported: `pcm16`, `g711_ulaw`, `g711_alaw`

### 5.3 PCM16 Specifications

- **Bit depth:** 16-bit signed integers
- **Sample rate:** 24,000 Hz
- **Channels:** Mono
- **Bitrate:** ~384 kbps raw, ~500 kbps base64 encoded
- **With compression:** 300-400 kbps (permessage-deflate)

### 5.4 Audio Configuration

```json
{
  "input_audio_format": "pcm16",
  "output_audio_format": "pcm16"
}
```

For telephony (Twilio, etc.):
```json
{
  "input_audio_format": "g711_ulaw",
  "output_audio_format": "g711_ulaw"
}
```

---

## 6. Voice Options

### 6.1 Available Voices (10 total)

| Voice | Character Description |
|-------|----------------------|
| `alloy` | Neutral, balanced |
| `ash` | Clear, articulate |
| `ballad` | Warm, expressive |
| `coral` | Friendly, conversational |
| `echo` | Smooth, calm |
| `sage` | Wise, measured |
| `shimmer` | Bright, energetic |
| `verse` | Poetic, melodic |
| `marin` | Natural, modern (newer) |
| `cedar` | Deep, authoritative (newer) |

### 6.2 Voice Configuration

```json
{
  "voice": "alloy"
}
```

**Note:** Voice cannot be changed mid-session. Once the model has emitted audio in a session, the voice is locked.

---

## 7. Noise Handling and Audio Processing

### 7.1 Background Noise Issues

OpenAI's VAD is sensitive to background noise, which can cause:
- Unintentional interruptions
- False speech detection
- Erratic turn-taking

### 7.2 Noise Reduction Strategies

**1. Adjust VAD Threshold:**
```json
{
  "turn_detection": {
    "type": "server_vad",
    "threshold": 0.7  // Higher = less noise sensitivity
  }
}
```

**2. Use Semantic VAD:**
Less sensitive to noise since it understands semantic completion.

**3. Client-Side Processing (Recommended):**
- **WebRTC AEC:** Built-in echo cancellation in browsers
- **Noise Suppression:** RNNoise, SpeexDSP, Krisp
- **Client-Side VAD:** Silero VAD for pre-filtering

**4. Custom VAD Implementation:**
```python
# Using Silero VAD client-side
from silero_vad import VADIterator

vad = VADIterator(
    model=silero_model,
    threshold=0.5,
    sampling_rate=16000,
    min_silence_duration_ms=100,
    speech_pad_ms=30
)

# Only send to OpenAI when speech is detected
for chunk in audio_stream:
    if vad(chunk) == "SPEECH_DETECTED":
        send_to_openai(chunk)
```

### 7.3 Echo Cancellation

**Browser-based (recommended):**
- Chrome, Safari, Edge have excellent built-in AEC
- Firefox has known issues - avoid for development

**Server-side options:**
- Krisp (commercial, high quality)
- WebRTC libraries with AEC
- SpeexDSP

---

## 8. Best Practices

### 8.1 VAD Tuning Recommendations

| Scenario | Mode | Settings |
|----------|------|----------|
| **Quick demos** | server_vad | threshold: 0.5, silence: 300ms |
| **Production voice bot** | server_vad | threshold: 0.5, silence: 500-600ms |
| **Thoughtful conversations** | semantic_vad | eagerness: "low" |
| **Fast-paced interactions** | semantic_vad | eagerness: "high" |
| **Noisy environments** | server_vad | threshold: 0.7-0.8 |
| **Push-to-talk** | none | Manual control |

### 8.2 Latency Optimization

1. **Use WebRTC over WebSocket** for client-server connections
2. **Implement connection pooling** for high-volume applications
3. **Pre-warm connections** before calls arrive
4. **Minimize middleware** between telephony and API
5. **Use G.711 directly** for telephony (no conversion)

### 8.3 Context Synchronization

Always truncate context on interruption:
```javascript
// Track audio played
let audioPlayedMs = 0;

// On interrupt
sendEvent({
  type: "conversation.item.truncate",
  item_id: currentResponseId,
  content_index: 0,
  audio_end_ms: audioPlayedMs
});
```

### 8.4 Transcription

Enable input transcription:
```json
{
  "input_audio_transcription": {
    "model": "gpt-4o-mini-transcribe"
  }
}
```

**Note:** Input transcription may lag 1-3 seconds behind model processing.

---

## 9. Common Issues and Solutions

### Issue: Model responds too quickly
**Solution:** Increase `silence_duration_ms` to 600-800ms or use semantic_vad with `eagerness: "low"`

### Issue: Model responds too slowly
**Solution:** Decrease `silence_duration_ms` to 300-400ms or use semantic_vad with `eagerness: "high"`

### Issue: Background noise triggers responses
**Solution:** Increase `threshold` to 0.7+ or implement client-side VAD filtering

### Issue: Speech gets cut off at beginning
**Solution:** Increase `prefix_padding_ms` to 400-500ms

### Issue: Semantic VAD fails on WebRTC connection
**Solution:** Create session with `server_vad` first, then update to `semantic_vad`

### Issue: Context mismatch after interruption
**Solution:** Always send `conversation.item.truncate` with actual audio duration heard

---

## Sources

1. **OpenAI Official Documentation**
   - VAD Guide: https://platform.openai.com/docs/guides/realtime-vad
   - API Reference: https://platform.openai.com/docs/api-reference/realtime
   - Realtime Conversations: https://platform.openai.com/docs/guides/realtime-conversations

2. **Pipecat / Daily.co - "The Missing Manual"**
   - https://www.latent.space/p/realtime-api
   - Comprehensive technical deep-dive from voice infrastructure experts

3. **Microsoft Azure Best Practices**
   - https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/voice-bot-gpt-4o-realtime-best-practices

4. **LiveKit Documentation**
   - https://docs.livekit.io/agents/models/realtime/plugins/openai/

5. **OpenAI Developer Community**
   - Turn detection discussions and semantic VAD implementation issues
   - https://community.openai.com/t/realtime-api-server-turn-detection-limitations-suggestion-help-request/966610

---

## Confidence Level

**High confidence** for:
- VAD parameter specifications and defaults
- Audio format requirements
- Voice options
- Basic interruption handling

**Medium confidence** for:
- Semantic VAD (relatively new, limited production experience documented)
- Exact timeout values for eagerness settings
- Noise handling effectiveness varies by implementation

**Information freshness:** Research conducted January 2026. Semantic VAD introduced March 2025. API actively evolving.

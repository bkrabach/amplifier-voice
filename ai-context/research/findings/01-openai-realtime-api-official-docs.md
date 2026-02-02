# OpenAI Realtime API - Comprehensive Research Document

**Research Date:** January 31, 2026  
**Status:** Generally Available (GA) as of August 28, 2025  
**Primary Model:** `gpt-realtime` (GA), `gpt-4o-realtime-preview` (Beta)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Models and Versions](#2-models-and-versions)
3. [Connection Methods](#3-connection-methods)
4. [WebRTC Implementation](#4-webrtc-implementation)
5. [Session Management](#5-session-management)
6. [Conversation Items](#6-conversation-items)
7. [Voice Activity Detection (VAD)](#7-voice-activity-detection-vad)
8. [Audio Formats](#8-audio-formats)
9. [Tool/Function Calling](#9-toolfunction-calling)
10. [Events Reference](#10-events-reference)
11. [Rate Limits](#11-rate-limits)
12. [Pricing](#12-pricing)
13. [Known Limitations](#13-known-limitations)
14. [Best Practices](#14-best-practices)
15. [Sources](#15-sources)

---

## 1. Overview

The OpenAI Realtime API enables low-latency, multimodal interactions with models that natively support speech-to-speech communication. Unlike traditional pipelines that chain STT → LLM → TTS, the Realtime API processes audio directly, resulting in more natural conversations with lower latency.

### Key Features
- **Native speech-to-speech:** GPT-4o processes audio directly without intermediate transcription
- **Bidirectional streaming:** Send and receive audio in real-time
- **Server-side conversation management:** API maintains conversation state
- **Automatic turn detection:** Built-in VAD for phrase endpointing
- **Interruption handling:** User can interrupt model output naturally
- **Function calling:** Tools work within realtime sessions
- **Multiple connection methods:** WebRTC (recommended for browsers), WebSocket, and SIP

### Architecture
```
Traditional Pipeline:  [audio] → [STT] → [LLM] → [TTS] → [audio]
Realtime API:          [audio] → [GPT-4o Realtime] → [audio]
```

---

## 2. Models and Versions

### GA Models (Recommended)
| Model | Description | Context Window |
|-------|-------------|----------------|
| `gpt-realtime` | Latest GA model, best quality | 32,768 tokens |
| `gpt-realtime-mini` | Smaller, faster, cheaper | 32,768 tokens |

### Beta/Preview Models
| Model | Description |
|-------|-------------|
| `gpt-4o-realtime-preview` | Original preview model |
| `gpt-4o-realtime-preview-2024-12-17` | Dated preview version |
| `gpt-4o-mini-realtime-preview` | Mini preview model |

### Available Voices
Current voice options: `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`, `marin`, `cedar`

**Recommended for GA model:** `marin` or `cedar` provide the best assistant voice quality.

> **Note:** Once audio is emitted in a session, the voice cannot be changed for that session.

---

## 3. Connection Methods

### WebRTC (Recommended for Browsers)
- Best for client-side browser applications
- Handles NAT traversal, packet loss, and latency automatically
- Uses ephemeral tokens for security
- Built-in echo cancellation and noise reduction

### WebSocket
- Good for server-to-server connections
- Simpler implementation for backend services
- Direct API key authentication
- Not recommended for browser clients (exposes API key)

### SIP (Session Initiation Protocol)
- For telephony integrations
- Supports G.711 audio codec
- Integration with phone systems

---

## 4. WebRTC Implementation

### Ephemeral Token Flow

1. **Server requests ephemeral token:**
```javascript
// Server-side (Node.js)
const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-realtime",
    voice: "marin",
  }),
});
const data = await response.json();
const ephemeralKey = data.client_secret.value;
```

2. **Client uses ephemeral token to establish WebRTC connection:**
```javascript
// Client-side (Browser)
const pc = new RTCPeerConnection();

// Set up audio playback
const audioEl = document.createElement("audio");
audioEl.autoplay = true;
pc.ontrack = e => audioEl.srcObject = e.streams[0];

// Add microphone input
const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
pc.addTrack(ms.getTracks()[0]);

// Create data channel for events
const dc = pc.createDataChannel("oai-events");
dc.addEventListener("message", (e) => {
  const event = JSON.parse(e.data);
  console.log("Server event:", event);
});

// SDP offer/answer exchange
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

const sdpResponse = await fetch(
  `https://api.openai.com/v1/realtime?model=gpt-realtime`,
  {
    method: "POST",
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${ephemeralKey}`,
      "Content-Type": "application/sdp"
    },
  }
);

const answer = {
  type: "answer",
  sdp: await sdpResponse.text(),
};
await pc.setRemoteDescription(answer);
```

### Ephemeral Token Properties
- **Expiration:** 60 seconds after creation
- **Session duration:** Up to 60 minutes (increased from 30 minutes in GA)
- **Security:** Locked to specific Realtime API session, cannot access other OpenAI APIs

---

## 5. Session Management

### Session Configuration
Configure sessions using `session.update` events:

```javascript
{
  "type": "session.update",
  "session": {
    "type": "realtime",
    "instructions": "You are a helpful assistant. Be concise.",
    "voice": "marin",
    "modalities": ["text", "audio"],
    "audio": {
      "input": {
        "format": "pcm16",
        "turn_detection": {
          "type": "server_vad",
          "threshold": 0.5,
          "prefix_padding_ms": 300,
          "silence_duration_ms": 500
        }
      },
      "output": {
        "format": "pcm16"
      }
    },
    "tools": [...],
    "temperature": 0.8  // Beta only, range 0.6-1.2
  }
}
```

### Session Limits (GA)
- **Maximum session duration:** 60 minutes
- **Token window:** 32,768 tokens
- **Maximum response tokens:** 4,096 tokens
- **Maximum input tokens:** 28,672 tokens
- **Instructions + tools max:** 16,384 tokens
- **Audio token rate:** ~800 tokens per minute of audio

### Context Truncation
When context exceeds limits, the API automatically truncates oldest messages. Configure with:

```javascript
{
  "type": "session.update",
  "session": {
    "truncation": {
      "type": "retention_ratio",
      "retention_ratio": 0.8  // Keep 80%, truncate 20%
    }
  }
}
```

Set `"truncation": "disabled"` to throw an error instead of truncating.

### Hosted Prompts (GA Feature)
Reference pre-configured prompts by ID:

```javascript
{
  "type": "session.update",
  "session": {
    "prompt": {
      "id": "pmpt_123",
      "version": "89",  // Optional: pin specific version
      "variables": {
        "city": "Paris"
      }
    }
  }
}
```

---

## 6. Conversation Items

### Creating Conversation Items
Inject content into the model's context using `conversation.item.create`:

```javascript
// Add a user message
{
  "type": "conversation.item.create",
  "item": {
    "type": "message",
    "role": "user",
    "content": [
      {
        "type": "input_text",
        "text": "Hello, how are you?"
      }
    ]
  }
}

// Add an assistant message (for context loading)
{
  "type": "conversation.item.create",
  "item": {
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "I'm doing well, thank you for asking!"
      }
    ]
  }
}
```

### Content Types
- `input_text` - Text input from user
- `input_audio` - Audio input from user (base64 encoded)
- `text` - Text content
- `audio` - Audio content (base64 encoded)

### Truncating Items (Important for Interruptions)
When user interrupts, truncate the conversation to match what was actually heard:

```javascript
{
  "type": "conversation.item.truncate",
  "item_id": "item_abc123",
  "content_index": 0,
  "audio_end_ms": 2500  // Truncate to 2.5 seconds
}
```

### Loading Conversation History
**Known Issue:** Loading previous messages may cause text-only responses even when audio is configured. Workaround:
1. Use text-only modality with separate TTS
2. Add an audio message as the first user message before loading history

---

## 7. Voice Activity Detection (VAD)

### VAD Types

#### Server VAD (Default)
Uses silence detection to determine when user stops speaking:

```javascript
{
  "turn_detection": {
    "type": "server_vad",
    "threshold": 0.5,           // 0.0-1.0, higher = less sensitive
    "prefix_padding_ms": 300,   // Audio before speech detection
    "silence_duration_ms": 500, // Silence before turn ends
    "create_response": true,    // Auto-create response
    "interrupt_response": true  // Allow interruptions
  }
}
```

#### Semantic VAD (GA Feature)
Uses a classifier to understand when user has finished their thought:

```javascript
{
  "turn_detection": {
    "type": "semantic_vad",
    "eagerness": "auto",  // "low", "medium", "high", or "auto"
    "create_response": true,
    "interrupt_response": true
  }
}
```

Eagerness levels:
- `low` - Lets users take their time (good for interviews)
- `medium` - Balanced approach
- `high` - Responds as soon as possible
- `auto` - Equivalent to medium

#### Manual Turn Detection
Disable VAD for push-to-talk interfaces:

```javascript
{
  "turn_detection": null
}
```

With manual mode, you must:
1. Send `input_audio_buffer.commit` to finalize audio
2. Send `response.create` to trigger model response

### Idle Timeouts (GA Feature)
Automatically prompt user if they go silent:

```javascript
{
  "turn_detection": {
    "type": "server_vad",
    "idle_timeout_ms": 6000  // Trigger after 6 seconds of silence
  }
}
```

---

## 8. Audio Formats

### Supported Formats

| Format | Sample Rate | Bit Depth | Use Case |
|--------|-------------|-----------|----------|
| `pcm16` | 24,000 Hz | 16-bit | Default, highest quality |
| `g711_ulaw` | 8,000 Hz | 8-bit | Telephony (μ-law) |
| `g711_alaw` | 8,000 Hz | 8-bit | Telephony (A-law) |

### Audio Specifications
- **PCM16:** 24kHz sample rate, 16-bit, mono, little-endian
- **Bitrate:** ~384 kbps uncompressed, ~500 kbps base64 encoded
- **With compression:** 300-400 kbps (WebSocket permessage-deflate)

### Sending Audio
```javascript
// Audio must be Int16Array or ArrayBuffer
// 24kHz sample rate, mono, 16-bit PCM
const audioData = new Int16Array(2400); // 0.1 seconds at 24kHz
client.appendInputAudio(audioData);
```

### Audio Token Consumption
- ~800 tokens per minute of audio
- Silent audio does not consume tokens (audio with no speech or significant noise)

---

## 9. Tool/Function Calling

### Defining Tools

```javascript
{
  "type": "session.update",
  "session": {
    "tools": [
      {
        "type": "function",
        "name": "get_weather",
        "description": "Get the current weather for a location",
        "parameters": {
          "type": "object",
          "properties": {
            "location": {
              "type": "string",
              "description": "City and state, e.g. San Francisco, CA"
            },
            "unit": {
              "type": "string",
              "enum": ["celsius", "fahrenheit"]
            }
          },
          "required": ["location"]
        }
      }
    ]
  }
}
```

### Handling Tool Calls

```javascript
// Listen for function calls
client.on('conversation.updated', ({ item, delta }) => {
  if (item.type === 'function_call') {
    if (item.status === 'completed') {
      // Execute the function
      const args = JSON.parse(item.arguments);
      const result = await executeFunction(item.name, args);
      
      // Send result back
      client.realtime.send('conversation.item.create', {
        item: {
          type: 'function_call_output',
          call_id: item.call_id,
          output: JSON.stringify(result)
        }
      });
      
      // Trigger response
      client.realtime.send('response.create');
    }
  }
});
```

### Asynchronous Function Calling (GA Feature)
GA models handle pending function calls gracefully:
- Session continues while function call is pending
- Model says "I'm still waiting on that" if asked about pending results
- No hallucinated responses for incomplete functions

### Tool Format Differences
**HTTP API format:**
```javascript
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "...",
    "parameters": {...}
  }
}
```

**Realtime API format:**
```javascript
{
  "type": "function",
  "name": "get_weather",
  "description": "...",
  "parameters": {...}
}
```

---

## 10. Events Reference

### Client Events (9 types)
Events sent from client to server:

| Event | Description |
|-------|-------------|
| `session.update` | Update session configuration |
| `input_audio_buffer.append` | Send audio data |
| `input_audio_buffer.commit` | Commit audio buffer (manual VAD) |
| `input_audio_buffer.clear` | Clear audio buffer |
| `conversation.item.create` | Add item to conversation |
| `conversation.item.truncate` | Truncate item content |
| `conversation.item.delete` | Delete item from conversation |
| `response.create` | Request model response |
| `response.cancel` | Cancel in-progress response |

### Server Events (28+ types)
Events sent from server to client:

| Event Category | Events |
|----------------|--------|
| **Session** | `session.created`, `session.updated` |
| **Conversation** | `conversation.created`, `conversation.item.created`, `conversation.item.truncated`, `conversation.item.deleted` |
| **Input Audio** | `input_audio_buffer.committed`, `input_audio_buffer.cleared`, `input_audio_buffer.speech_started`, `input_audio_buffer.speech_stopped`, `input_audio_buffer.timeout_triggered` |
| **Response** | `response.created`, `response.output_item.added`, `response.output_item.done`, `response.content_part.added`, `response.content_part.done`, `response.done` |
| **Audio** | `response.audio.delta`, `response.audio.done` |
| **Text** | `response.text.delta`, `response.text.done` |
| **Transcription** | `response.audio_transcript.delta`, `response.audio_transcript.done`, `conversation.item.input_audio_transcription.completed` |
| **Function Calls** | `response.function_call_arguments.delta`, `response.function_call_arguments.done` |
| **Rate Limits** | `rate_limits.updated` |
| **Errors** | `error` |

---

## 11. Rate Limits

### Session Limits
- **Tier 5:** ~100 concurrent sessions
- Lower tiers have proportionally fewer concurrent sessions

### Token Limits
- Rate limits vary by usage tier
- Applied per minute (TPM - Tokens Per Minute)
- Cached tokens have higher limits

### Connection Limits
- Maximum session duration: 60 minutes (GA), 30 minutes (beta)
- Idle connection timeout: 15 minutes without activity

---

## 12. Pricing

### GA Model Pricing (`gpt-realtime`)

| Token Type | Price per 1M tokens |
|------------|---------------------|
| Text Input | $4.00 |
| Text Cached Input | $0.40 |
| Text Output | $16.00 |
| Audio Input | $32.00 |
| Audio Cached Input | $0.40 |
| Audio Output | $64.00 |

### Mini Model Pricing (`gpt-realtime-mini`)

| Token Type | Price per 1M tokens |
|------------|---------------------|
| Text Input | $0.60 |
| Text Cached Input | $0.06 |
| Text Output | $2.40 |
| Audio Input | $10.00 |
| Audio Cached Input | $0.30 |
| Audio Output | $20.00 |

### Preview Model Pricing (`gpt-4o-realtime-preview`)

| Token Type | Price per 1M tokens |
|------------|---------------------|
| Text Input | $5.00 |
| Text Cached Input | $2.50 |
| Audio Input | $100.00 |
| Audio Cached Input | $20.00 |
| Audio Output | $200.00 |

### Estimated Conversation Costs (70% talk time)
| Duration | Estimated Cost |
|----------|----------------|
| 1 minute | ~$0.11 |
| 2 minutes | ~$0.26 |
| 5 minutes | ~$0.92 |
| 10 minutes | ~$2.68 |
| 15 minutes | ~$5.28 |

### Cost Optimization
- **Token caching:** Cached audio tokens are 80% cheaper
- **Truncation strategy:** Use retention_ratio to bust cache less often
- **Text conversion:** Replace old audio messages with text summaries
- **Silent audio:** Not billed (no speech or significant background noise)

---

## 13. Known Limitations

### Current Limitations
1. **No conversation context retrieval:** Cannot export full conversation state
2. **No audio history loading:** Cannot load "assistant" audio messages into context
3. **Voice lock:** Once audio is emitted, voice cannot be changed for session
4. **Text-after-history bug:** Loading text history may cause text-only responses
5. **Input transcription lag:** Can lag behind model output by seconds
6. **No word-level alignment:** Cannot align transcription with audio timing

### Beta vs GA Feature Gaps
| Feature | GA Model | Beta Model |
|---------|----------|------------|
| Image input | Yes | No |
| Async function calling | Yes | No |
| Audio token → text | Yes | No |
| EU data residency | Yes | Only 06-03 |
| MCP support | Best | Limited |

### Temperature Behavior
- GA: Temperature parameter removed (fixed at optimal value)
- Beta: Limited to 0.6-1.2 range, default 0.8
- Low temperature does NOT make responses deterministic for audio
- Use prompting to control consistency

### VAD Sensitivity
- Server VAD more sensitive to background noise than some alternatives
- May trigger on short audio spikes
- Recommend silence_duration_ms >= 500ms for production

---

## 14. Best Practices

### Connection Best Practices
1. **Use WebRTC for browsers** - Better latency, built-in audio processing
2. **Use WebSocket for servers** - Simpler for backend integrations
3. **Implement reconnection logic** - Sessions can disconnect unexpectedly
4. **Monitor connection health** - Use ping/pong or heartbeat patterns

### Audio Best Practices
1. **Use Chrome or Safari** - Firefox has buggy echo cancellation
2. **Avoid Bluetooth audio** - Adds 100-300ms latency
3. **Target 800ms voice-to-voice latency** - Good conversational feel
4. **Include mute/unmute controls** - Essential for demos in noisy environments

### Conversation Best Practices
1. **Always truncate on interruption** - Keep context accurate
2. **Enable input transcription** - Useful for logging and moderation
3. **Summarize long conversations** - Replace old audio with text summaries
4. **Use retention_ratio** - Reduce cache busting from truncation

### Prompting Best Practices
1. **Test in the Realtime Playground** - Iterate quickly on prompts
2. **Be specific with instructions** - GA model follows instructions closely
3. **Use marin or cedar voices** - Best quality for assistants
4. **Rewrite prompts for GA** - Beta prompts may behave differently

### Security Best Practices
1. **Never expose API keys in browser** - Use ephemeral tokens
2. **Validate on server side** - Don't trust client-provided data
3. **Monitor usage** - Track per-session token consumption
4. **Set usage limits** - Prevent runaway costs

### UI Best Practices
1. **Add force-reply button** - Workaround for VAD issues
2. **Show audio level indicator** - Confirm mic is working
3. **Display transcripts** - Users want to see what was said
4. **Handle errors gracefully** - Network issues will happen

---

## 15. Sources

### Official Documentation
- OpenAI Realtime API Guide: https://platform.openai.com/docs/guides/realtime
- Realtime WebRTC Guide: https://platform.openai.com/docs/guides/realtime-webrtc
- API Reference: https://platform.openai.com/docs/api-reference/realtime
- Client Events: https://platform.openai.com/docs/api-reference/realtime-client-events
- Server Events: https://platform.openai.com/docs/api-reference/realtime-server-events
- Pricing: https://openai.com/api/pricing/

### Official Repositories
- Realtime Console: https://github.com/openai/openai-realtime-console
- Reference Client: https://github.com/openai/openai-realtime-api-beta
- Realtime Agents: https://github.com/openai/openai-realtime-agents

### Developer Resources
- Developer Notes (Sep 2025): https://developers.openai.com/blog/realtime-api
- GA Announcement: https://openai.com/index/introducing-gpt-realtime/
- LiveKit Integration: https://docs.livekit.io/agents/integrations/realtime/openai/

### Community Resources
- "The Missing Manual" by Latent.Space: https://www.latent.space/p/realtime-api
- Pipecat Framework: https://github.com/pipecat-ai/pipecat
- Cost Calculator: https://docs.google.com/spreadsheets/d/1EL-mjqlmj4ehug8BjmgmAFm9uFZtZXY9N9EvqLm8Ebc/

---

## Appendix: Quick Reference Code Snippets

### Minimal WebSocket Connection (Node.js)
```javascript
import WebSocket from "ws";

const url = "wss://api.openai.com/v1/realtime?model=gpt-realtime";
const ws = new WebSocket(url, {
  headers: {
    Authorization: "Bearer " + process.env.OPENAI_API_KEY,
  },
});

ws.on("open", () => {
  console.log("Connected");
  ws.send(JSON.stringify({
    type: "session.update",
    session: {
      instructions: "You are a helpful assistant.",
      voice: "marin",
    }
  }));
});

ws.on("message", (data) => {
  const event = JSON.parse(data);
  console.log("Event:", event.type);
});
```

### Reference Client Usage
```javascript
import { RealtimeClient } from '@openai/realtime-api-beta';

const client = new RealtimeClient({ apiKey: process.env.OPENAI_API_KEY });

client.updateSession({
  instructions: 'You are a helpful assistant.',
  voice: 'marin',
  turn_detection: { type: 'server_vad' },
  input_audio_transcription: { model: 'whisper-1' },
});

client.on('conversation.updated', ({ item, delta }) => {
  if (delta?.audio) {
    // Play audio
  }
  if (delta?.transcript) {
    // Display transcript
  }
});

await client.connect();
client.sendUserMessageContent([{ type: 'input_text', text: 'Hello!' }]);
```

---

**Document Version:** 1.0  
**Last Updated:** January 31, 2026  
**Confidence Level:** High - Based on official documentation and verified community resources

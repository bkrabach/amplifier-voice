# OpenAI Realtime API - Technical Quick Reference

> **Version:** 1.0 | **Last Updated:** January 2026 | **API Status:** GA (gpt-realtime)

---

## Quick Links

| Section | Jump To |
|---------|---------|
| [API Endpoints](#1-api-endpoints) | Connection URLs, authentication |
| [Events Cheat Sheet](#2-events-cheat-sheet) | All client/server events |
| [Code Snippets](#3-code-snippets) | Copy-paste patterns |
| [VAD Configuration](#4-vad-configuration) | Turn detection settings |
| [Audio Formats](#5-audio-formats) | Codec specs |
| [Error Reference](#6-error-reference) | Common errors & fixes |
| [Latency Targets](#7-latency-targets) | Performance benchmarks |
| [Token & Cost Reference](#8-token--cost-reference) | Limits and pricing |
| [Tool Calling Pattern](#9-tool-calling-pattern) | Exact working sequence |

---

## 1. API Endpoints

### Connection URLs

```
WebRTC:    https://api.openai.com/v1/realtime?model=gpt-realtime
WebSocket: wss://api.openai.com/v1/realtime?model=gpt-realtime
Sessions:  https://api.openai.com/v1/realtime/sessions (POST - get ephemeral token)
Calls:     https://api.openai.com/v1/realtime/calls (POST - WebRTC SDP exchange)
```

### Models

| Model | Use Case | Context |
|-------|----------|---------|
| `gpt-realtime` | Production (best quality) | 32k tokens |
| `gpt-realtime-mini` | Cost-sensitive (3-5x cheaper) | 32k tokens |
| `gpt-4o-realtime-preview` | Legacy/beta | 128k tokens |

### Voices

```
alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar
```
**Recommended:** `marin` or `cedar` for assistant quality  
**Note:** Voice locked after first audio emission in session

### Authentication

```javascript
// Server-side: Get ephemeral token
const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${OPENAI_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ model: "gpt-realtime", voice: "marin" })
});
const { client_secret } = await response.json();
const ephemeralKey = client_secret.value;  // Valid ~60s, session lasts 60min
```

---

## 2. Events Cheat Sheet

### Client → Server Events (9 total)

| Event | Purpose | When to Send |
|-------|---------|--------------|
| `session.update` | Configure session | After connection, to change settings |
| `input_audio_buffer.append` | Send audio chunk | Continuously while user speaks |
| `input_audio_buffer.commit` | Finalize audio | Manual VAD mode only |
| `input_audio_buffer.clear` | Discard buffer | On cancel/reset |
| `conversation.item.create` | Add message | Inject context, tool results |
| `conversation.item.truncate` | Trim content | After interruption |
| `conversation.item.delete` | Remove item | Context management |
| `response.create` | Request response | After tool result, manual mode |
| `response.cancel` | Stop generation | On interruption |

### Server → Client Events (Key ones)

| Event | What It Means | Handle It |
|-------|---------------|-----------|
| `session.created` | Connection ready | Send `session.update` |
| `session.updated` | Config applied | Verify settings |
| `input_audio_buffer.speech_started` | User speaking | UI feedback |
| `input_audio_buffer.speech_stopped` | User stopped | Await response |
| `response.created` | Response starting | Show "thinking" |
| `response.audio.delta` | Audio chunk | Play immediately |
| `response.audio_transcript.delta` | Transcript chunk | Display text |
| `response.function_call_arguments.done` | Tool call ready | **Execute tool** |
| `response.done` | Response complete | Update state, check usage |
| `conversation.item.input_audio_transcription.completed` | User transcript | Logging/display |
| `error` | Something failed | Handle gracefully |
| `rate_limits.updated` | Limit info | Monitor usage |

### Event Payload Structures

```javascript
// session.update
{
  type: "session.update",
  session: {
    instructions: "You are helpful.",
    voice: "marin",
    modalities: ["text", "audio"],
    turn_detection: { type: "server_vad", ... },
    input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
    tools: [{ type: "function", name: "...", ... }],
    temperature: 0.8  // Beta only
  }
}

// conversation.item.create (text)
{
  type: "conversation.item.create",
  item: {
    type: "message",
    role: "user",  // or "assistant", "system"
    content: [{ type: "input_text", text: "Hello" }]
  }
}

// conversation.item.create (tool result)
{
  type: "conversation.item.create",
  item: {
    type: "function_call_output",
    call_id: "call_xyz123",
    output: JSON.stringify({ result: "data" })  // MUST stringify!
  }
}

// conversation.item.truncate
{
  type: "conversation.item.truncate",
  item_id: "item_abc",
  content_index: 0,
  audio_end_ms: 2500  // What user actually heard
}
```

---

## 3. Code Snippets

### Minimal WebRTC Connection (Browser)

```javascript
async function connect(ephemeralKey, model = "gpt-realtime") {
  const pc = new RTCPeerConnection();
  
  // Audio output
  const audioEl = document.createElement("audio");
  audioEl.autoplay = true;
  pc.ontrack = e => audioEl.srcObject = e.streams[0];
  
  // Microphone input
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  pc.addTrack(stream.getTracks()[0]);
  
  // Data channel for events
  const dc = pc.createDataChannel("oai-events");
  dc.onmessage = e => handleEvent(JSON.parse(e.data));
  
  // SDP exchange
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  
  const res = await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ephemeralKey}`, "Content-Type": "application/sdp" },
    body: offer.sdp
  });
  await pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
  
  return { pc, dc };
}
```

### Minimal WebSocket Connection (Node.js)

```javascript
import WebSocket from "ws";

const ws = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-realtime", {
  headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
});

ws.on("open", () => {
  ws.send(JSON.stringify({
    type: "session.update",
    session: { instructions: "You are helpful.", voice: "marin" }
  }));
});

ws.on("message", data => {
  const event = JSON.parse(data);
  console.log(event.type, event);
});
```

### Session Configuration Template

```javascript
const sessionConfig = {
  type: "session.update",
  session: {
    instructions: "Be concise and helpful.",
    voice: "marin",
    modalities: ["text", "audio"],
    turn_detection: {
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500,
      create_response: true,
      interrupt_response: true
    },
    input_audio_transcription: { model: "gpt-4o-mini-transcribe" },
    tools: [],
    max_response_output_tokens: 4096
  }
};
```

### Interruption Handler

```javascript
let lastItemId = "";
let playedMs = 0;

// Track what's actually been played
function onAudioPlayed(itemId, durationMs) {
  lastItemId = itemId;
  playedMs += durationMs;
}

// On user interruption
function handleInterruption() {
  // 1. Cancel response
  dc.send(JSON.stringify({ type: "response.cancel" }));
  
  // 2. Truncate to what was heard
  if (lastItemId) {
    dc.send(JSON.stringify({
      type: "conversation.item.truncate",
      item_id: lastItemId,
      content_index: 0,
      audio_end_ms: playedMs
    }));
  }
  
  // 3. Clear audio buffer
  audioPlayer.flush();
  playedMs = 0;
}
```

---

## 4. VAD Configuration

### Server VAD (Default)

```javascript
{
  turn_detection: {
    type: "server_vad",
    threshold: 0.5,           // 0.0-1.0 (higher = less sensitive)
    prefix_padding_ms: 300,   // Audio before speech detection
    silence_duration_ms: 500, // Wait after silence
    create_response: true,    // Auto-respond
    interrupt_response: true  // Allow barge-in
  }
}
```

| Parameter | Range | Quiet Room | Noisy Room | Fast Q&A | Thoughtful |
|-----------|-------|------------|------------|----------|------------|
| threshold | 0-1 | 0.4-0.5 | 0.6-0.8 | 0.5 | 0.5 |
| prefix_padding_ms | 100-500 | 300 | 300 | 200 | 400 |
| silence_duration_ms | 200-1000 | 500 | 600 | 300-400 | 800-1000 |

### Semantic VAD (Smarter)

```javascript
{
  turn_detection: {
    type: "semantic_vad",
    eagerness: "medium",  // "low" | "medium" | "high" | "auto"
    create_response: true,
    interrupt_response: true
  }
}
```

| Eagerness | Behavior | Max Wait | Best For |
|-----------|----------|----------|----------|
| low | Patient, lets user think | 8s | Interviews, complex topics |
| medium | Balanced (default) | 4s | General conversation |
| high | Quick responses | 2s | Fast Q&A, commands |

**Limitation:** Cannot use `semantic_vad` on initial WebRTC connection. Start with `server_vad`, then update.

### Manual Mode (Push-to-Talk)

```javascript
{ turn_detection: null }

// You must manually:
// 1. input_audio_buffer.append (send audio)
// 2. input_audio_buffer.commit (when user done)
// 3. response.create (trigger response)
```

---

## 5. Audio Formats

### Supported Formats

| Format | Sample Rate | Bits | Use Case |
|--------|-------------|------|----------|
| `pcm16` | 24,000 Hz | 16 | Default, highest quality |
| `g711_ulaw` | 8,000 Hz | 8 | US telephony (μ-law) |
| `g711_alaw` | 8,000 Hz | 8 | Intl telephony (A-law) |

### PCM16 Specs

- **Encoding:** 16-bit signed integers, little-endian, mono
- **Raw bitrate:** ~384 kbps
- **Base64 bitrate:** ~500 kbps
- **Compressed:** ~300-400 kbps (with permessage-deflate)

### WebRTC Codecs (Automatic)

| Codec | Priority | Notes |
|-------|----------|-------|
| Opus | Primary | 48kHz, FEC enabled |
| PCMU | Fallback | G.711 μ-law |
| PCMA | Fallback | G.711 A-law |

**Note:** Don't set `input_audio_format`/`output_audio_format` for WebRTC - browser handles it.

### Token Consumption

- **Audio input:** 1 token per 100ms (~600 tokens/min)
- **Audio output:** 1 token per 50ms (~1200 tokens/min)
- **Approximate:** ~800 tokens per minute of speech (70% talk time)
- **Silent audio:** Not billed

---

## 6. Error Reference

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Conversation already has an active response` | Sent `response.create` while generating | Wait for `response.done` first |
| `Tool call ID not found in conversation` | Wrong `call_id` in tool result | Use exact `call_id` from event |
| `session_expired` | Hit 60-minute limit | Create new session, transfer context |
| `invalid_request_error` | Malformed event | Check JSON structure |
| `rate_limit_exceeded` | Too many requests | Implement backoff |
| `context_length_exceeded` | Too many tokens | Truncate/summarize history |

### WebSocket Close Codes

| Code | Meaning | Action |
|------|---------|--------|
| 1000 | Normal closure | Expected |
| 1006 | Abnormal closure | Reconnect |
| 1011 | Server error | Retry with backoff |

### WebRTC Connection States

| State | Meaning | Action |
|-------|---------|--------|
| `connected` | Good | Continue |
| `disconnected` | Temporary loss | Wait for recovery |
| `failed` | Unrecoverable | Reconnect |
| `closed` | Session ended | Start new session |

### Debugging Tools

- **Chrome:** `chrome://webrtc-internals`
- **Firefox:** `about:webrtc`
- **Safari:** Web Inspector → Media tab

---

## 7. Latency Targets

### Voice-to-Voice Benchmarks

| Metric | Target | Good | Acceptable | Critical |
|--------|--------|------|------------|----------|
| Time-to-First-Byte | <500ms | <800ms | <1200ms | >1500ms |
| Total Voice-to-Voice | <800ms | <1200ms | <1500ms | >2000ms |
| P50 Response | <1.5s | <1.7s | <2.0s | >2.5s |
| P95 Response | <3.5s | <5.0s | <6.0s | >7.0s |

### Latency Budget Breakdown

| Component | Target | Notes |
|-----------|--------|-------|
| VAD/Turn detection | 200-400ms | `silence_duration_ms` setting |
| Network round-trip | 50-150ms | Use nearby region |
| Model inference | 200-400ms | Realtime API handles this |
| Audio playback start | 50-100ms | Stream immediately |

### Optimization Checklist

- [ ] Use WebRTC (not WebSocket) for clients
- [ ] Pre-warm connection before user interaction
- [ ] Set `silence_duration_ms` to 400-500ms
- [ ] Stream audio output immediately (don't buffer)
- [ ] Use `gpt-realtime-mini` for lower latency
- [ ] Monitor P95, not just averages

---

## 8. Token & Cost Reference

### Session Limits

| Limit | Value |
|-------|-------|
| Max session duration | 60 minutes (GA), 30 min (Azure) |
| Context window | 32,768 tokens |
| Max response tokens | 4,096 tokens |
| Max input tokens | 28,672 tokens |
| Instructions + tools | 16,384 tokens |

### Pricing (per 1M tokens)

| Type | gpt-realtime | gpt-realtime-mini |
|------|--------------|-------------------|
| Text Input | $4.00 | $0.60 |
| Text Cached | $0.40 | $0.06 |
| Text Output | $16.00 | $2.40 |
| Audio Input | $32.00 | $10.00 |
| Audio Cached | $0.40 | $0.30 |
| Audio Output | $64.00 | $20.00 |

### Real-World Cost Estimates

| Conversation Length | Unoptimized | Optimized |
|--------------------|-------------|-----------|
| 1 minute | ~$0.30 | ~$0.15 |
| 5 minutes | ~$0.60/min | ~$0.20/min |
| 10 minutes | ~$1.20/min | ~$0.22/min |

**Key insight:** Tokens accumulate across turns. Cost grows exponentially without management.

### Cost Optimization

```javascript
// 1. Configure truncation
{
  truncation: {
    type: "retention_ratio",
    retention_ratio: 0.8  // Keep 80% on overflow
  }
}

// 2. Delete old items
{ type: "conversation.item.delete", item_id: "old_item" }

// 3. Summarize long conversations
// - Collect transcripts
// - Summarize with gpt-4o-mini
// - Update instructions with summary
// - Delete audio items (they're expensive!)
```

### Rate Limits by Tier

| Tier | RPM | TPM |
|------|-----|-----|
| 1 | 200 | 40,000 |
| 2 | 400 | 200,000 |
| 3 | 5,000 | 800,000 |
| 4 | 10,000 | 4,000,000 |
| 5 | 20,000 | 15,000,000 |

---

## 9. Tool Calling Pattern

### The Exact Working Sequence

```
1. Define tools in session.update
2. User speaks → Model decides to call tool
3. Listen for: response.function_call_arguments.done
4. Execute your function
5. Send: conversation.item.create (type: function_call_output)
6. Send: response.create  ← CRITICAL! Model won't auto-respond
7. Model speaks the result
```

### Tool Definition

```javascript
{
  type: "session.update",
  session: {
    tools: [{
      type: "function",
      name: "get_weather",
      description: "Get weather. Say 'checking the weather' before calling.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City name" },
          unit: { type: "string", enum: ["celsius", "fahrenheit"] }
        },
        required: ["location"]
      }
    }],
    tool_choice: "auto"  // NOT "required" (causes infinite loop!)
  }
}
```

### Tool Call Handler

```javascript
async function handleEvent(event) {
  if (event.type === "response.function_call_arguments.done") {
    const { name, arguments: argsJson, call_id } = event;
    
    try {
      const args = JSON.parse(argsJson);
      const result = await executeFunction(name, args);
      
      // Step 5: Send result
      dc.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: call_id,  // Must match!
          output: JSON.stringify(result)  // Must stringify!
        }
      }));
      
      // Step 6: Trigger response (REQUIRED!)
      dc.send(JSON.stringify({ type: "response.create" }));
      
    } catch (error) {
      // Return error as output, don't throw
      dc.send(JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: call_id,
          output: JSON.stringify({ error: error.message })
        }
      }));
      dc.send(JSON.stringify({ type: "response.create" }));
    }
  }
}
```

### Multiple Tool Calls

```javascript
// When model calls multiple tools in one response:
// Wait for response.done, then send ALL results, then ONE response.create

const pendingCalls = [];

if (event.type === "response.function_call_arguments.done") {
  pendingCalls.push({ name: event.name, args: event.arguments, call_id: event.call_id });
}

if (event.type === "response.done") {
  // Execute all tools
  for (const call of pendingCalls) {
    const result = await executeFunction(call.name, JSON.parse(call.args));
    dc.send(JSON.stringify({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result) }
    }));
  }
  // One response.create at the end
  dc.send(JSON.stringify({ type: "response.create" }));
  pendingCalls.length = 0;
}
```

### Tool Calling Pitfalls

| Problem | Cause | Solution |
|---------|-------|----------|
| Infinite loop | `tool_choice: "required"` | Use `"auto"` instead |
| No response after tool | Missing `response.create` | Always send it after tool result |
| "Tool call ID not found" | Wrong `call_id` | Use exact ID from event |
| Parse error | Forgot to stringify | Always `JSON.stringify(result)` |

---

## Quick Debugging Checklist

### Connection Issues
- [ ] Ephemeral token not expired? (~60s validity)
- [ ] Correct model name in URL?
- [ ] WebRTC: Data channel created before `setLocalDescription`?
- [ ] Firewall allowing UDP:3478 or TCP:443?

### No Audio Output
- [ ] `modalities` includes `"audio"`?
- [ ] Audio element has `autoplay`?
- [ ] `ontrack` handler set before connection?
- [ ] User granted microphone permission?

### No Response
- [ ] VAD detecting speech? Check `speech_started` events
- [ ] Using manual mode? Need `response.create`
- [ ] Tool call pending? Need `response.create` after result
- [ ] Check for `error` events

### Poor Quality
- [ ] Using WebRTC (not WebSocket) for clients?
- [ ] `silence_duration_ms` > 500ms?
- [ ] Echo cancellation working? (Use Chrome/Safari)
- [ ] Check `chrome://webrtc-internals` for packet loss

---

## Network Requirements

### Ports

| Protocol | Port | Required |
|----------|------|----------|
| UDP | 3478 | Primary (preferred) |
| TCP | 443 | Fallback |
| HTTPS | 443 | API calls |

### Bandwidth

| Mode | Minimum | Recommended |
|------|---------|-------------|
| Audio only | 50 kbps | 100 kbps |
| Audio + Video | 200 kbps | 500 kbps |

### No STUN/TURN Needed

OpenAI provides ICE candidates directly. Simple setup:
```javascript
const pc = new RTCPeerConnection();  // No iceServers needed
```

---

## Session Lifecycle Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Get ephemeral token (server-side, valid 60s)                 │
│ 2. Create RTCPeerConnection + data channel "oai-events"         │
│ 3. Add audio track, create offer, send to /v1/realtime          │
│ 4. Set remote description from response                         │
│ 5. Wait for data channel "open"                                 │
│ 6. Send session.update with config                              │
│ 7. Handle events, send/receive audio                            │
│ 8. On interrupt: response.cancel + conversation.item.truncate   │
│ 9. On tool call: item.create (result) + response.create         │
│ 10. Session expires at 60 minutes - create new if needed        │
└─────────────────────────────────────────────────────────────────┘
```

---

*Keep this open while coding. For detailed explanations, see the full research documents.*

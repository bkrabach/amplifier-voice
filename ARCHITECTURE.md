# Amplifier Voice Assistant Architecture

## Overview

Amplifier Voice is a real-time voice assistant that combines:
- **OpenAI gpt-realtime-1.5** model for voice I/O (speech-to-speech)
- **Microsoft Amplifier** (programmatic) for tool execution
- **WebRTC** for browser-based audio streaming
- **Server-side sideband WebSocket** for intercepting and executing all tool calls

## Architecture Diagram

```
Browser Client (React UI)
  - Pure audio transport (no tool execution in client)
  - Microphone input / Speaker output
  |
  | WebRTC (direct to OpenAI -- audio ONLY)
  |
  v
OpenAI Realtime API (gpt-realtime-1.5)
  - Voice I/O + function calling
  - 32K context, prompt caching
  - Audio streams directly to/from browser
  - Tool calls routed to sideband WebSocket
  ^
  |
  | Sideband WebSocket (server-side control plane)
  |
FastAPI Backend (voice-server)
  +-- Session + SDP Endpoints
  |     /session  -- create session, return secret
  |     /sdp      -- exchange SDP, return X-Call-Id header
  |
  +-- Sideband Control Plane
  |     /voice/sideband  -- connect sideband WS to OpenAI session
  |     /voice/end       -- cleanup session resources
  |     Intercepts ALL tool calls server-side
  |     Sends retention_ratio truncation config on connect
  |     Injects tool results back into session
  |
  +-- AmplifierBridge (long-lived)
  |     Programmatic foundation integration
  |     Single session for server lifetime
  |     Direct coordinator.call_tool()
  |
  | Direct Python calls
  v
Amplifier Foundation
  - Bundle loading + tool mounting
  - Session management + coordinator
  - delegate tool (sync) + dispatch tool (async)
  - Specialist agents via Anthropic Claude
```

## Data Flow

### 1. Session Creation

```
Client                Backend              OpenAI            Amplifier
  │                      │                   │                  │
  │──GET /session──────▶│                   │                  │
  │                      │                   │                  │
  │                      │──get_tools()─────▶                  │
  │                      │◀─tools list──────┘                  │
  │                      │                   │                  │
  │                      │──POST /v1/realtime/client_secrets──▶│
  │                      │   {session: {type: "realtime",      │
  │                      │              tools: [...]}}         │
  │                      │◀─{value: "ek_..."}───────────────────┘
  │◀─{client_secret}────┘                   │                  │
```

### 2. WebRTC Connection

```
Client                Backend              OpenAI
  │                      │                   │
  │──Create offer────▶  │                   │
  │──POST /sdp─────────▶│                   │
  │   (SDP offer)        │                   │
  │                      │──POST /v1/realtime/calls──▶
  │                      │   (SDP offer)     │
  │                      │◀─SDP answer───────┘
  │◀─SDP answer─────────┘                   │
  │                      │                   │
  │◀════WebRTC Audio════════════════════════▶
```

### 3. Sideband Connection

```
Client                Backend              OpenAI
  │                      │                   │
  │  (after WebRTC connected)               │
  │──POST /voice/sideband──▶│               │
  │   {call_id, session_id} │               │
  │                      │──WSS connect────▶│
  │                      │   (sideband WS)  │
  │                      │──session.update──▶│
  │                      │   (retention_ratio truncation)
  │◀─{status: "connected"}──┘               │
```

### 4. Voice Conversation with Tool Calls (via Sideband)

```
Browser Audio        OpenAI Realtime       Sideband (Backend)    Amplifier
     │                     │                      │                  │
     │──Audio chunks──────▶│                      │                  │
     │                     │──VAD detects turn───▶│                  │
     │                     │──LLM processes──────▶│                  │
     │                     │                      │                  │
     │                     │──function_call.done─▶│                  │
     │                     │   (via sideband WS)  │                  │
     │                     │                      │──call_tool()────▶│
     │                     │                      │◀─result──────────┘
     │                     │◀─function_output─────┘                  │
     │                     │   (injected via WS)  │                  │
     │◀─Audio response─────┘                      │                  │
```

**Key difference from old architecture**: The browser never sees tool calls. All tool
execution is handled server-side via the sideband WebSocket. The browser is a pure
audio transport.

### 5. Async Dispatch (Fire-and-Forget)

```
Browser Audio        OpenAI Realtime       Sideband (Backend)    Amplifier
     │                     │                      │                  │
     │──"Research Tesla"──▶│                      │                  │
     │                     │──dispatch call──────▶│                  │
     │                     │                      │──background task─▶│
     │                     │◀─"Working on it"─────┘                  │
     │◀─Audio: "Dispatched"┘                      │                  │
     │                     │                      │                  │
     │──"What else..."────▶│  (user keeps talking)│                  │
     │◀─Audio response─────┘                      │                  │
     │                     │                      │◀─result──────────┘
     │                     │◀─inject result───────┘  (when done)     │
     │◀─Audio: "Done!"─────┘                      │                  │
```

## Key Components

### OpenAI Realtime API (gpt-realtime-1.5)

**Model**: `gpt-realtime-1.5` (GA)

**Capabilities**:
- Native speech-to-speech (no STT→LLM→TTS pipeline)
- Multimodal: audio, text, image inputs
- Function calling in real-time
- 32K context window
- **Prompt caching**: 90% cost savings on system instructions and tool definitions

**Connection**: WebRTC from browser → OpenAI servers

**Pricing** (with caching):
- Text input: $0.40/1M (cached) vs $4/1M (uncached)
- Audio input: $0.40/1M (cached) vs $32/1M (uncached)
- Audio output: $64/1M

**Session limits**:
- 15 minutes maximum duration
- 128K token context limit

### Amplifier Integration (Programmatic)

**Pattern**: Long-lived session approach (not CLI-based)

**Flow**:
```python
# Server startup
from amplifier_foundation.bundle import load_bundle

bundle = await load_bundle("amplifier-dev")
prepared = await bundle.prepare()
session = await prepared.create_session(session_cwd=cwd)

# Extract tools
coordinator = session.coordinator
tool_registry = coordinator._tools

# Execute tools directly (no subprocess!)
result = await tool_mount.call(**arguments)
```

**Benefits**:
- Zero subprocess overhead
- Single session for entire server lifetime
- Context persistence across voice conversations
- Direct Python API calls
- All amplifier-dev tools available (~13+ tools)

**Available Tools** (exposed to voice model):
- `delegate` — Synchronous agent delegation (quick tasks, 1-5s). Model waits for result.
- `dispatch` — Asynchronous fire-and-forget delegation (heavy tasks, 10s-5min). Model keeps talking; result injected when done.

**Available Agents** (via delegate/dispatch tools):
- `foundation:explorer` - Explore codebases, find files, understand structure
- `foundation:zen-architect` - Design systems, review architecture
- `foundation:modular-builder` - Write code, implement features
- `foundation:bug-hunter` - Debug issues, fix errors
- `foundation:git-ops` - Git commits, PRs, branch management
- `foundation:web-research` - Search the web, fetch information

Agents run on Anthropic Claude and have access to all Amplifier tools internally.

### FastAPI Backend

**Purpose**: Middle tier that bridges OpenAI and Amplifier

**Endpoints**:
- `GET /session` - Create Realtime session with tools
- `POST /sdp` - Exchange WebRTC SDP (returns `X-Call-Id` header)
- `POST /voice/sideband` - Connect server-side sideband WebSocket
- `POST /voice/end` - End session and cleanup sideband
- `GET /health` - Health check
- `GET /tools` - List available tools

**Lifecycle**:
- Startup: Initialize Amplifier bridge once
- Runtime: Serve requests, manage sideband connections, execute tools
- Shutdown: Cleanup sideband connections and Amplifier resources

### React Client

**Purpose**: Browser UI with WebRTC audio

**Features**:
- Microphone input with echo cancellation
- Speaker output with audio playback
- Start/stop conversation controls
- Visual feedback (waveform, status)

## GA API Migration

### What Changed from Beta

**Endpoints**:
- Session creation: `/v1/realtime/sessions` → `/v1/realtime/client_secrets`
- SDP exchange: `/v1/realtime?model=...` → `/v1/realtime/calls`

**Session structure**:
```diff
- {
-   "model": "gpt-4o-realtime-preview",
-   "voice": "alloy",
-   "tools": [...]
- }

+ {
+   "session": {
+     "type": "realtime",
+     "model": "gpt-realtime-1.5",
+     "audio": {
+       "output": {"voice": "alloy"}
+     },
+     "tools": [...]
+   }
+ }
```

**Model**:
- Beta: `gpt-4o-realtime-preview-2024-12-17`
- GA: `gpt-realtime-1.5` (20% cheaper, better quality)

## Cost Optimization

### Prompt Caching (Automatic)

OpenAI automatically caches:
- System instructions (~2K tokens)
- Tool definitions (~3K tokens per tool)

**Savings**: 90% reduction on cached content

**Typical costs per voice turn**:
```
System/tools (cached):    $0.02  (was $0.20)
User audio (15 sec):      $0.48
Assistant audio (10 sec): $0.64
────────────────────────────────
Total:                    ~$1.14 per exchange
```

### Context Management — Retention Ratio Truncation

The sideband automatically sends a `session.update` with `retention_ratio` on connect.
This tells OpenAI to auto-truncate old context when the session approaches its limit,
keeping the most recent portion of the conversation.

**Configuration**: Set `RETENTION_RATIO` env var (default: `0.8`, range: 0.0–1.0)

### Cost Management Strategies

1. **Session duration**: Keep conversations under 5 minutes when possible
2. **Retention ratio**: Auto-truncation keeps context manageable (default: 0.8)
3. **Tool optimization**: Only include tools likely to be used
4. **Audio quality**: 24kHz is sufficient (don't use higher rates)

## Production Considerations

### WebRTC vs WebSocket

**Why WebRTC for browser?**
- Lower latency (UDP vs TCP)
- Better audio quality (Opus codec)
- Built-in echo cancellation
- Packet dropping for late audio (no head-of-line blocking)

**Why WebSocket for server?**
- Simpler implementation
- Consistent low-latency on server networks
- No NAT traversal needed

### Error Handling

**Session timeout (15 min)**:
- Save conversation history
- Reconnect with context summary
- Continue from where left off

**Audio interruptions**:
- Use `conversation.item.truncate` to remove unheard audio
- Track audio playback position accurately
- Handle rapid interruptions gracefully

**Tool failures**:
- Return structured error to OpenAI
- Model generates fallback response
- Log for debugging

### Security

**API key protection**:
- Never expose OpenAI API key to client
- Server creates ephemeral tokens (client_secret)
- Tokens are short-lived and session-specific

**Tool execution**:
- Server validates all tool calls
- Sanitize arguments before execution
- Rate limiting on tool execution
- Audit logging for sensitive operations

## Development Setup

See `amplifier-voice/SETUP.md` for detailed setup instructions.

## References

- **OpenAI Realtime API**: https://platform.openai.com/docs/guides/realtime
- **Amplifier Foundation**: https://github.com/microsoft/amplifier-foundation
- **WebRTC**: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API

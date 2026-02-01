# Amplifier Voice Assistant Architecture

## Overview

Amplifier Voice is a real-time voice assistant that combines:
- **OpenAI gpt-realtime** model for voice I/O (speech-to-speech)
- **Microsoft Amplifier** (programmatic) for tool execution
- **WebRTC** for browser-based audio streaming

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                    Browser Client                            │
│  - React UI                                                  │
│  - WebRTC audio (24kHz PCM)                                 │
│  - Microphone input → Speaker output                        │
└────────────┬─────────────────────────────────────────────────┘
             │ WebRTC (SDP exchange)
             ▼
┌──────────────────────────────────────────────────────────────┐
│              FastAPI Backend (voice-server)                  │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  Session Endpoint (/session)                   │         │
│  │  - Creates OpenAI Realtime session             │         │
│  │  - Configures tools from Amplifier             │         │
│  │  - Returns ephemeral client_secret             │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  SDP Endpoint (/sdp)                           │         │
│  │  - Exchanges WebRTC SDP with OpenAI            │         │
│  │  - Establishes audio connection                │         │
│  └────────────────────────────────────────────────┘         │
│                                                              │
│  ┌────────────────────────────────────────────────┐         │
│  │  AmplifierBridge (Long-lived)                  │         │
│  │  - Programmatic foundation integration         │         │
│  │  - Single session for server lifetime          │         │
│  │  - Direct coordinator.call_tool()              │         │
│  │  - No subprocess overhead                      │         │
│  └────────────────────────────────────────────────┘         │
└──────────┬───────────────────────────┬───────────────────────┘
           │                           │
           │ HTTPS REST                │ Direct Python calls
           ▼                           ▼
┌──────────────────────┐    ┌──────────────────────────┐
│  OpenAI Realtime API │    │  Amplifier Foundation    │
│  - gpt-realtime      │    │  - Bundle loading        │
│  - Voice I/O         │    │  - Tool mounting         │
│  - Function calling  │    │  - Session management    │
│  - 32K context       │    │  - Coordinator           │
│  - Prompt caching    │    └──────────────────────────┘
└──────────────────────┘
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

### 3. Voice Conversation with Tool Calls

```
Browser Audio        OpenAI Realtime          Backend            Amplifier Tools
     │                     │                      │                     │
     │──Audio chunks──────▶│                      │                     │
     │                     │──VAD detects turn────▶                     │
     │                     │──LLM processes───────▶                     │
     │                     │                      │                     │
     │                     │──function_call.done──▶                     │
     │                     │                      │                     │
     │                     │                      │──execute_tool()────▶│
     │                     │                      │◀─result────────────┘
     │                     │◀─function_output─────┘                     │
     │                     │                      │                     │
     │◀─Audio response─────┘                      │                     │
```

## Key Components

### OpenAI Realtime API (gpt-realtime)

**Model**: `gpt-realtime` (GA, August 2025)

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

bundle = await load_bundle("exp-amplifier-dev")
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

**Available Tool**:
- `tool-delegate` - Spawn specialist agents (the ONLY tool exposed to voice model)

**Available Agents** (via delegate tool):
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
- `POST /sdp` - Exchange WebRTC SDP
- `GET /health` - Health check
- `GET /tools` - List available tools

**Lifecycle**:
- Startup: Initialize Amplifier bridge once
- Runtime: Serve requests, execute tools
- Shutdown: Cleanup Amplifier resources

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
+     "model": "gpt-realtime",
+     "audio": {
+       "output": {"voice": "alloy"}
+     },
+     "tools": [...]
+   }
+ }
```

**Model**:
- Beta: `gpt-4o-realtime-preview-2024-12-17`
- GA: `gpt-realtime` (20% cheaper, better quality)

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

### Cost Management Strategies

1. **Session duration**: Keep conversations under 5 minutes when possible
2. **Context rewriting**: Periodically summarize and clear old messages
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

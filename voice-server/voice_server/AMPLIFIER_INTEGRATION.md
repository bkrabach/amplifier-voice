# Amplifier Integration

This document describes the integration between the Amplifier voice assistant and Microsoft Amplifier.

## Architecture Overview

The voice assistant uses a clean hybrid architecture:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Voice Client (React)                             │
│                                                                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐   │
│  │   useWebRTC     │    │ useChatMessages │    │ TranscriptDisplay│   │
│  │  (Audio Stream) │    │  (Events/Tools) │    │   (UI Render)    │   │
│  └────────┬────────┘    └────────┬────────┘    └──────────────────┘   │
│           │                      │                                      │
│           └──────────────────────┴──────────────────────────────────   │
│                          WebRTC / HTTP                                  │
└────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Voice Server (FastAPI)                             │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                     OpenAI Realtime API                          │  │
│  │  - Session creation with client secrets                          │  │
│  │  - WebRTC SDP exchange                                           │  │
│  │  - Voice I/O (STT/TTS)                                           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                               │                                         │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                     Amplifier Bridge                             │  │
│  │  - Tool discovery and execution                                  │  │
│  │  - Session management                                            │  │
│  │  - Voice protocol adapters                                       │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                               │                                         │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                 Amplifier Core/Foundation                        │  │
│  │  - tool-filesystem    - tool-bash    - tool-web                  │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Components

1. **OpenAI Realtime API** - Handles voice I/O (Speech-to-Text and Text-to-Speech) via WebRTC
2. **Amplifier Bridge** - Manages the delegate tool and agent spawning
3. **Delegate Tool** - Routes work to specialist AI agents running on Anthropic Claude
4. **Specialist Agents** - explorer, architect, builder, bug-hunter, git-ops, web-research

## Configuration

### Environment Variables

```bash
# Required
OPENAI_API_KEY=your_api_key

# Amplifier Configuration (optional)
AMPLIFIER_BUNDLE=amplifier-dev      # Bundle with delegate tool
ANTHROPIC_API_KEY=sk-ant-...        # Required for agent delegation
AMPLIFIER_CWD=/path/to/working    # Working directory for tools (default: current directory)
AMPLIFIER_AUTO_APPROVE=true       # Auto-approve tools (recommended for voice)
```

### Settings

Configuration is managed in `config.py`:

```python
class RealtimeSettings:
    model: str = "gpt-4o-realtime-preview-2024-12-17"
    voice: str = "verse"  # alloy, ash, ballad, coral, echo, sage, shimmer, verse
    session_config: dict = {...}

class AmplifierSettings:
    bundle: str = "amplifier-dev"      # Bundle with delegate tool
    cwd: str = os.getcwd()
    auto_approve: bool = True
    tool_timeout: float = 300.0  # Agent tasks can take longer
    # Only delegate tool exposed to voice model - agents have full tool access
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/session` | Create voice session with Amplifier tools |
| POST | `/sdp` | Exchange SDP for WebRTC connection |
| POST | `/execute/{tool_name}` | Execute a tool via Amplifier |
| GET | `/tools` | List available tools |
| GET | `/health` | Health check with Amplifier status |

### Tool Execution

```bash
# Execute a tool
curl -X POST http://localhost:8080/execute/read_file \
    -H "Content-Type: application/json" \
    -d '{"path": "/path/to/file.txt"}'

# Response
{
    "success": true,
    "output": "file contents...",
    "error": null
}
```

## Protocol Adapters

### VoiceEventHook

Captures tool execution events and converts them to voice-friendly format:

- `voice_tool_start` - Tool execution started
- `voice_tool_complete` - Tool execution finished
- `voice_tool_error` - Tool execution failed

### VoiceDisplaySystem

Handles display messages optimized for voice output.

### VoiceApprovalSystem

Manages tool approvals with auto-approve policy for voice interactions.

## Frontend Events

The frontend handles these event types:

```typescript
enum VoiceChatEventType {
    // OpenAI Realtime events
    SPEECH_STARTED = 'input_audio_buffer.speech_started',
    TRANSCRIPTION_COMPLETED = 'conversation.item.input_audio_transcription.completed',
    ASSISTANT_DELTA = 'response.audio_transcript.delta',
    ASSISTANT_DONE = 'response.audio_transcript.done',
    FUNCTION_CALL_DONE = 'response.function_call_arguments.done',

    // Amplifier events
    VOICE_TOOL_START = 'voice_tool_start',
    VOICE_TOOL_COMPLETE = 'voice_tool_complete',
    VOICE_TOOL_ERROR = 'voice_tool_error',
    VOICE_DISPLAY = 'voice_display',
}
```

## Bundle Configuration

Custom bundles can be defined in `bundles/voice.yaml`:

```yaml
bundle:
  name: voice-assistant
  version: 1.0.0

tools:
  - module: tool-filesystem
  - module: tool-bash
  - module: tool-web

behaviors:
  - name: voice-auto-approve
    hooks:
      - module: hooks-approval
        config:
          auto_approve: true
```

## Development

### Running Locally

```bash
# Install dependencies
cd voice-server
uv pip install -e .

# Start the server
start-service

# With debug logging
LOG_LEVEL=DEBUG start-service
```

### Project Structure

```
voice-server/
├── voice_server/
│   ├── __init__.py
│   ├── config.py           # Configuration settings
│   ├── service.py          # FastAPI application
│   ├── realtime.py         # OpenAI Realtime API
│   ├── amplifier_bridge.py # Amplifier integration
│   ├── bundles/
│   │   └── voice.yaml      # Voice bundle config
│   └── protocols/
│       ├── __init__.py
│       ├── voice_hooks.py     # Event streaming
│       ├── voice_display.py   # Display messages
│       └── voice_approval.py  # Tool approvals
└── pyproject.toml
```

## Troubleshooting

### Amplifier Not Initializing

If you see "Amplifier not available" errors:

```bash
uv pip install "amplifier-core @ git+https://github.com/microsoft/amplifier-core@main"
uv pip install "amplifier-foundation @ git+https://github.com/microsoft/amplifier-foundation@main"
```

### Tool Execution Timeouts

Increase timeout in environment:

```bash
# In .env or environment
AMPLIFIER_TOOL_TIMEOUT=120
```

### WebRTC Connection Issues

1. Check STUN server connectivity
2. Verify OpenAI API key is valid
3. Check browser console for ICE candidate errors

# Amplifier Voice Server

Real-time voice assistant powered by OpenAI's Realtime API (`gpt-realtime-1.5`) and Microsoft Amplifier for tool execution. All tool calls are handled server-side via a sideband WebSocket control plane.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (WebRTC — pure audio transport)                        │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Microphone → OpenAI Realtime (gpt-realtime-1.5) → Speaker│  │
│  │  (no tool execution in client)                            │  │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↕ Sideband WebSocket
┌─────────────────────────────────────────────────────────────────┐
│  Voice Server (FastAPI)                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  /session          - Create ephemeral API keys            │   │
│  │  /sdp              - WebRTC SDP exchange (+ X-Call-Id)    │   │
│  │  /voice/sideband   - Connect sideband WS to OpenAI       │   │
│  │  /voice/end        - End session, cleanup resources       │   │
│  │  /tools            - List available tools                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ Direct Python calls
┌─────────────────────────────────────────────────────────────────┐
│  Amplifier Bridge (Programmatic)                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • Load amplifier-dev bundle                              │   │
│  │  • delegate tool (sync) + dispatch tool (async)           │   │
│  │  • Execute tools via coordinator                          │   │
│  │  • Return results to OpenAI via sideband WS               │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### OpenAI Realtime API Integration
- **WebRTC connection** for low-latency browser audio
- **Ephemeral key generation** for secure client connections
- **SDP exchange** for WebRTC session establishment
- **Server-side tool execution** via sideband WebSocket control plane

### Amplifier Integration (NEW!)
- **Programmatic bundle loading** - Uses `amplifier-foundation` directly (not CLI)
- **13+ tools available** - bash, filesystem, web search, Python tools, recipes, and more
- **Direct tool execution** - Calls tools via coordinator.get("tools") API
- **Session management** - Proper initialization and lifecycle

### Available Tools

The server uses the `amplifier-dev` bundle which includes:

| Tool | Description |
|------|-------------|
| `bash` | Execute shell commands |
| `read_file` | Read file contents |
| `write_file` | Write files |
| `edit_file` | Edit files with string replacement |
| `glob` | Find files by pattern |
| `grep` | Search file contents |
| `web_fetch` | Fetch web content |
| `web_search` | Search the web |
| `task` | Spawn sub-agents |
| `todo` | Task management |
| `recipes` | Multi-step workflows |
| `python_check` | Python code quality |
| `load_skill` | Load domain knowledge |

## Quick Start

### 1. Install

```bash
cd voice-server

# Create and activate virtual environment
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install package and dependencies
uv pip install -e .
```

### 2. Configure

Create `.env` file:

```bash
# OpenAI API key (required)
OPENAI_API_KEY=sk-...

# Amplifier configuration (optional)
AMPLIFIER_BUNDLE=amplifier-dev  # Default bundle with all tools
AMPLIFIER_CWD=/path/to/your/project  # Working directory for tools (default: current directory)
AMPLIFIER_AUTO_APPROVE=true  # Auto-approve tool execution

# Context management
RETENTION_RATIO=0.8  # Auto-truncation ratio (0.0-1.0, default: 0.8)

# Server configuration (optional)
SERVICE_HOST=0.0.0.0
SERVICE_PORT=8000
LOG_LEVEL=INFO
```

### 3. Run

```bash
# Start server
uv run voice-server

# Or with custom port
uv run voice-server --port 8080
```

### 4. Test

Open the web client:
```bash
cd ../voice-client
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## API Endpoints

### POST /session
Create ephemeral API key for client WebRTC connection.

**Request:**
```json
{
  "voice": "ash"
}
```

**Response:**
```json
{
  "client_secret": {
    "value": "ek_...",
    "expires_at": 1234567890
  }
}
```

### POST /sdp
Exchange SDP for WebRTC connection.

**Request:** `application/sdp` body with offer SDP

**Response:** `application/sdp` body with answer SDP

### POST /voice/sideband
Connect server-side sideband WebSocket to the OpenAI session for tool call handling.

**Request:**
```json
{
  "call_id": "rtc_...",
  "session_id": "sess_..."
}
```

**Response:**
```json
{
  "status": "connected",
  "call_id": "rtc_..."
}
```

### POST /voice/end
End a voice session and clean up sideband resources.

**Request:**
```json
{
  "call_id": "rtc_..."
}
```

### GET /tools
List all available Amplifier tools in OpenAI function format.

**Response:**
```json
[
  {
    "type": "function",
    "name": "bash",
    "description": "Execute shell commands",
    "parameters": { ... }
  },
  ...
]
```

### GET /health
Health check endpoint.

## How It Works

### 1. Client Initialization

```javascript
// Client requests ephemeral key
const { client_secret } = await fetch('/session', {
  method: 'POST',
  body: JSON.stringify({ voice: 'ash' })
}).then(r => r.json());

// Client establishes WebRTC connection
const pc = new RTCPeerConnection();
// ... add audio tracks ...
const offer = await pc.createOffer();
await pc.setLocalDescription(offer);

// Exchange SDP
const answer = await fetch('/sdp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/sdp' },
  body: offer.sdp
}).then(r => r.text());

await pc.setRemoteDescription({ type: 'answer', sdp: answer });
```

### 2. Tool Execution Flow (via Sideband)

```
User speaks → OpenAI Realtime detects intent → Tool call event
                                                      ↓
                              Sideband WS intercepts function_call
                                                      ↓
                              Amplifier Bridge executes tool
                                                      ↓
                              Result injected back via sideband WS
                                                      ↓
                            OpenAI synthesizes speech response
                                                      ↓
                                        User hears result

Note: For dispatch (async) tools, the model keeps talking while the
tool executes in the background. Results are injected when done.
```

### 3. Amplifier Bridge

The bridge provides programmatic access to Amplifier:

```python
from voice_server.amplifier_bridge import get_amplifier_bridge

# Initialize with bundle
bridge = await get_amplifier_bridge(
    bundle="amplifier-dev",
    cwd="/path/to/project"
)

# Get tools for OpenAI
tools = bridge.get_tools_for_openai()

# Execute tool
result = await bridge.execute_tool(
    "bash",
    {"command": "ls -la"}
)

if result.success:
    print(result.output)
else:
    print(result.error)
```

## OpenAI Realtime API (GA)

This server uses the **GA (General Availability) version** of the Realtime API with the `gpt-realtime-1.5` model.

### Key Changes from Beta

1. **Session type required**: Must specify `type: "realtime"` in session config
2. **New event names**: 
   - `response.text.delta` → `response.output_text.delta`
   - `response.audio.delta` → `response.output_audio.delta`
3. **New model name**: `gpt-realtime-1.5` (not `gpt-4o-realtime-preview`)
4. **Audio config moved**: Voice and audio settings now under `audio.output`

### Configuration

```python
{
    "session": {
        "type": "realtime",
        "model": "gpt-realtime-1.5",
        "modalities": ["audio", "text"],
        "audio": {
            "output": {
                "voice": "ash"  # or "sage", "marin", "coral", "ash"
            }
        },
        "turn_detection": {
            "type": "server_vad",
            "threshold": 0.5,
            "prefix_padding_ms": 300,
            "silence_duration_ms": 500
        }
    }
}
```

## Development

### Run Tests

```bash
# Quick startup test
uv run python test_startup.py

# This tests:
# - Settings load
# - Amplifier bridge initialization (13 tools)
# - Tool execution (read_file)
# - FastAPI app creation
```

### Project Structure

```
voice-server/
├── voice_server/
│   ├── __init__.py          # Package initialization
│   ├── config.py            # Settings and OpenAI configuration
│   ├── amplifier_bridge.py  # Programmatic Amplifier integration
│   ├── realtime.py          # OpenAI Realtime API client
│   ├── sideband.py          # Server-side sideband WebSocket control plane
│   ├── service.py           # FastAPI endpoints
│   ├── start.py             # Server entry point
│   └── tools/
│       ├── __init__.py
│       └── dispatch_tool.py # Async dispatch tool definition
├── tests/                   # Test suite (86 tests)
│   ├── test_sideband.py
│   ├── test_background_jobs.py
│   ├── test_dispatch_tool.py
│   ├── test_realtime.py
│   └── ...
├── pyproject.toml           # Dependencies
├── .env                     # Environment variables
└── README.md                # This file
```

### Adding Custom Tools

To add your own tools, create a custom Amplifier bundle:

```yaml
---
bundle:
  name: amplifier-voice-custom
  version: 1.0.0

# Include base tools
includes:
  - amplifier-dev

# Add custom modules
tools:
  - module: my-custom-tool
    source: git+https://github.com/you/amplifier-module-my-tool@main

---

# Custom instructions for the assistant
You have access to custom domain-specific tools...
```

Then update `.env`:
```bash
AMPLIFIER_BUNDLE=amplifier-voice-custom
```

## Troubleshooting

### "No tools available"

Make sure Amplifier bundle is configured:
```bash
# .env
AMPLIFIER_BUNDLE=amplifier-dev
```

### "Failed to initialize Amplifier"

Check that dependencies are installed:
```bash
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -e .
```

### "OpenAI API error"

Verify API key in `.env`:
```bash
OPENAI_API_KEY=sk-...
```

### Tool execution fails

Check working directory:
```bash
# .env
AMPLIFIER_CWD=/path/to/your/project
```

## Next Steps

- [ ] Add authentication/authorization
- [ ] Implement session cleanup
- [ ] Add metrics and monitoring
- [ ] Create custom tools for domain-specific tasks
- [ ] Deploy to production (consider costs!)

## Resources

- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [Amplifier Documentation](https://github.com/microsoft/amplifier)
- [WebRTC Basics](https://webrtc.org/getting-started/overview)

## License

See parent project for license information.

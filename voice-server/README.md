# Amplifier Voice Server

Real-time voice assistant powered by OpenAI's Realtime API (`gpt-realtime`) and Microsoft Amplifier for tool execution.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (WebRTC)                                               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Microphone → OpenAI Realtime (gpt-realtime) → Speaker   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (tool calls)
┌─────────────────────────────────────────────────────────────────┐
│  Voice Server (FastAPI)                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  /session - Create ephemeral API keys                    │   │
│  │  /sdp - WebRTC SDP exchange                              │   │
│  │  /execute/{tool_name} - Tool execution endpoint          │   │
│  │  /tools - List available tools                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  Amplifier Bridge (Programmatic)                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  • Load amplifier-dev bundle                             │   │
│  │  • Mount 13+ tools (bash, filesystem, web, python, etc.) │   │
│  │  • Execute tools via coordinator                         │   │
│  │  • Return results to OpenAI                              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### OpenAI Realtime API Integration
- **WebRTC connection** for low-latency browser audio
- **Ephemeral key generation** for secure client connections
- **SDP exchange** for WebRTC session establishment
- **Server-side tool execution** with webhook pattern

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
cd /Users/brkrabac/repos/realtime-voice/amplifier-voice/voice-server

# Create virtual environment
python3 -m venv .venv

# Install package and dependencies
.venv/bin/pip install -e .
```

### 2. Configure

Create `.env` file:

```bash
# OpenAI API key (required)
OPENAI_API_KEY=sk-...

# Amplifier configuration (optional)
AMPLIFIER_BUNDLE=amplifier-dev  # Default bundle with all tools
AMPLIFIER_CWD=/path/to/your/project  # Working directory for tools
AMPLIFIER_AUTO_APPROVE=true  # Auto-approve tool execution

# Server configuration (optional)
SERVICE_HOST=0.0.0.0
SERVICE_PORT=8000
LOG_LEVEL=INFO
```

### 3. Run

```bash
# Start server
.venv/bin/python -m voice_server.start

# Or with custom port
.venv/bin/python -m voice_server.start --port 8080
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

### POST /execute/{tool_name}
Execute an Amplifier tool.

**Request:**
```json
{
  "arguments": {
    "command": "ls -la"
  }
}
```

**Response:**
```json
{
  "success": true,
  "output": "total 48\ndrwxr-xr-x  ..."
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

### 2. Tool Execution Flow

```
User speaks → OpenAI Realtime detects intent → Tool call event
                                                      ↓
                                    POST /execute/{tool_name}
                                                      ↓
                              Amplifier Bridge executes tool
                                                      ↓
                                  Result sent back to OpenAI
                                                      ↓
                            OpenAI synthesizes speech response
                                                      ↓
                                        User hears result
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

This server uses the **GA (General Availability) version** of the Realtime API with the `gpt-realtime` model.

### Key Changes from Beta

1. **Session type required**: Must specify `type: "realtime"` in session config
2. **New event names**: 
   - `response.text.delta` → `response.output_text.delta`
   - `response.audio.delta` → `response.output_audio.delta`
3. **New model name**: `gpt-realtime` (not `gpt-4o-realtime-preview`)
4. **Audio config moved**: Voice and audio settings now under `audio.output`

### Configuration

```python
{
    "session": {
        "type": "realtime",
        "model": "gpt-realtime",
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
.venv/bin/python test_startup.py

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
│   ├── service.py           # FastAPI endpoints
│   └── start.py             # Server entry point
├── pyproject.toml           # Dependencies
├── .env                     # Environment variables
├── test_startup.py          # Startup validation
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
.venv/bin/pip install -e .
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
AMPLIFIER_CWD=/Users/brkrabac/repos/realtime-voice/amplifier-voice
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

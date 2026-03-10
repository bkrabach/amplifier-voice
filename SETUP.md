# Amplifier Voice Assistant - Setup Guide

## Quick Start

### 1. Backend Setup

```bash
cd voice-server

# Create .env file
cat > .env << 'EOF'
OPENAI_API_KEY=your_openai_api_key_here
AMPLIFIER_BUNDLE=amplifier-dev
ANTHROPIC_API_KEY=your_anthropic_api_key_here
AMPLIFIER_CWD=/path/to/your/working/directory
EOF

# Create and activate virtual environment
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
uv pip install -e .

# Start the server
uv run voice-server
```

### 2. Frontend Setup

```bash
cd voice-client

# Dependencies already installed

# Start the dev server
npm run dev
```

### 3. Access

Open your browser to: **http://localhost:5173**

Click "Start Voice Chat" to begin!

---

## Architecture

### Voice Flow
1. **Client** requests session from **Server**
2. **Server** creates OpenAI Realtime session with tools
3. **Client** establishes WebRTC connection via SDP exchange
4. **Client** calls `POST /voice/sideband` with call_id for server-side control
5. **Server** opens sideband WebSocket to the same OpenAI session
6. **OpenAI** handles voice-to-text and text-to-voice
7. **Server** intercepts all tool calls via the sideband and executes them via **Amplifier**
8. **Results** are injected back into the session via the sideband WebSocket

### Amplifier Integration

The server uses **AmplifierBridge** to:
- Load the `amplifier-dev` bundle with the `delegate` and `dispatch` tools
- Spawn specialist agents (explorer, architect, builder, etc.) via Anthropic Claude
- Execute delegated tasks with timeout and error handling
- Convert tool definitions to OpenAI function calling format

The voice model has TWO tools:
- `delegate` — Synchronous agent delegation (quick tasks, 1-5s)
- `dispatch` — Asynchronous fire-and-forget delegation (heavy tasks, 10s-5min; user can keep talking)

---

## Configuration

### Backend (.env)

```bash
# Required
OPENAI_API_KEY=sk-...

# Amplifier settings
AMPLIFIER_BUNDLE=amplifier-dev           # Bundle with delegate tool
AMPLIFIER_AUTO_APPROVE=true              # Auto-approve tool execution (recommended for voice)
AMPLIFIER_CWD=/path/to/working/dir       # Working directory for tools (default: current directory)
AMPLIFIER_TOOL_TIMEOUT=60.0              # Tool execution timeout (seconds)

# Server settings
HOST=0.0.0.0
PORT=8080

# Context management
RETENTION_RATIO=0.8              # Auto-truncation ratio (0.0-1.0, default: 0.8)
```

### OpenAI Model

Currently using: `gpt-realtime-1.5` (GA model with prompt caching)

Available voices: `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`

Set in `voice_server/config.py`

---

## API Endpoints

### `GET /session`
Create a new voice session with Amplifier-powered tools.

**Response:**
```json
{
  "id": "session_123",
  "client_secret": {
    "value": "ephemeral_token",
    "expires_at": 123456789
  },
  "model": "gpt-realtime-1.5",
  "tools": [...]
}
```

### `POST /sdp`
Exchange SDP for WebRTC connection.

**Headers:**
- `Authorization: Bearer <ephemeral_token>`

**Body:** SDP offer (application/sdp)

**Response:** SDP answer + `X-Call-Id` response header (used for sideband connection)

### `POST /voice/sideband`
Connect server-side sideband WebSocket to the OpenAI session for tool call handling.

**Body:**
```json
{
  "call_id": "rtc_...",
  "session_id": "sess_..."
}
```

### `POST /voice/end`
End a voice session and clean up sideband resources.

**Body:**
```json
{
  "call_id": "rtc_..."
}
```

### `GET /tools`
List available Amplifier tools.

### `GET /health`
Health check with service status.

---

## Development

### Backend Structure

```
voice-server/
├── voice_server/
│   ├── amplifier_bridge.py    # Amplifier integration
│   ├── config.py               # Configuration
│   ├── realtime.py             # OpenAI Realtime API client
│   ├── service.py              # FastAPI app + endpoints
│   ├── sideband.py             # Server-side sideband WebSocket control plane
│   ├── tools/                  # Tool definitions
│   │   ├── __init__.py
│   │   └── dispatch_tool.py    # Async dispatch tool definition
│   └── protocols/              # Voice-specific protocols
│       ├── voice_approval.py
│       └── voice_display.py
└── pyproject.toml
```

### Frontend Structure

```
voice-client/
├── src/
│   ├── components/
│   │   ├── VoiceChat.tsx       # Main UI component
│   │   ├── TranscriptDisplay.tsx
│   │   └── MessageBubble.tsx
│   ├── hooks/
│   │   ├── useVoiceChat.ts     # Main hook
│   │   ├── useWebRTC.ts        # WebRTC connection
│   │   └── useChatMessages.ts  # Message state
│   └── models/
│       └── VoiceChatEvent.ts   # Event types
└── package.json
```

---

## Troubleshooting

### "No module named 'amplifier_core'"

Amplifier dependencies not installed. Run:
```bash
cd voice-server
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -e .
```

### "WebRTC connection failed"

1. Check server is running on port 8080
2. Verify OPENAI_API_KEY is set
3. Check browser console for errors
4. Ensure microphone permissions granted

### "Tools not available"

1. Check Amplifier bundle loaded: `curl http://localhost:8080/tools`
2. Verify AMPLIFIER_BUNDLE environment variable
3. Check server logs for Amplifier initialization errors

---

## Next Steps

- Add more Amplifier tools (task delegation, web search, etc.)
- Implement approval UI for sensitive operations
- Add visual indicators for tool execution
- Persist conversation history
- Add recording/playback features

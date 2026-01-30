# Amplifier Voice Assistant - Setup Guide

## Quick Start

### 1. Backend Setup

```bash
cd voice-server

# Create .env file
cat > .env << 'EOF'
OPENAI_API_KEY=your_openai_api_key_here
AMPLIFIER_BUNDLE=foundation
AMPLIFIER_AUTO_APPROVE=true
AMPLIFIER_CWD=/path/to/your/working/directory
EOF

# Dependencies already installed, just activate
source .venv/bin/activate

# Start the server
uvicorn voice_server.service:app --host 0.0.0.0 --port 8080 --reload
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
4. **OpenAI** handles voice-to-text and text-to-voice
5. **Server** executes tools via **Amplifier** when requested
6. **Results** stream back through WebRTC data channel

### Amplifier Integration

The server uses **AmplifierBridge** to:
- Load Amplifier bundles (default: `foundation`)
- Discover available tools (`tool-filesystem`, `tool-bash`, `tool-web`)
- Execute tools with timeout and error handling
- Convert tool definitions to OpenAI function calling format

Tools are automatically injected into the OpenAI Realtime session configuration.

---

## Configuration

### Backend (.env)

```bash
# Required
OPENAI_API_KEY=sk-...

# Amplifier settings
AMPLIFIER_BUNDLE=foundation              # Bundle to use
AMPLIFIER_AUTO_APPROVE=true              # Auto-approve tool execution (recommended for voice)
AMPLIFIER_CWD=/path/to/working/dir       # Working directory for tools
AMPLIFIER_TOOL_TIMEOUT=60.0              # Tool execution timeout (seconds)

# Server settings
HOST=0.0.0.0
PORT=8080
```

### OpenAI Model

Currently using: `gpt-realtime` (GA model with prompt caching)

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
  "model": "gpt-4o-realtime-preview-2024-12-17",
  "tools": [...]
}
```

### `POST /sdp`
Exchange SDP for WebRTC connection.

**Headers:**
- `Authorization: Bearer <ephemeral_token>`

**Body:** SDP offer (application/sdp)

**Response:** SDP answer

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
│   ├── service.py              # FastAPI app
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
source .venv/bin/activate
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

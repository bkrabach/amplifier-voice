# Amplifier Voice Assistant - Quick Start

Get up and running with the voice assistant in 5 minutes.

## Prerequisites

- Python 3.11+
- Node.js 18+ (for client)
- OpenAI API key with Realtime API access
- Amplifier installed: `uv tool install git+https://github.com/microsoft/amplifier`

## Setup

### 1. Environment Variables

Create `.env` in `voice-server/`:

```bash
# Required
OPENAI_API_KEY=sk-proj-...

# Optional (defaults shown)
VOICE_MODEL=gpt-realtime
VOICE=alloy
MAX_TURNS=10
```

### 2. Install Backend Dependencies

```bash
cd voice-server
uv pip install -e .
```

This will install:
- FastAPI backend
- amplifier-foundation (brings in amplifier-core)
- All required dependencies

### 3. Install Frontend Dependencies

```bash
cd voice-client
npm install
```

## Running

### Start Backend (Terminal 1)

```bash
cd voice-server
python -m voice_server
```

You should see:
```
INFO: Initializing Amplifier bridge...
INFO: Amplifier bridge initialized with 13 tools
INFO: Service lifespan started
INFO: Uvicorn running on http://0.0.0.0:8000
```

### Start Frontend (Terminal 2)

```bash
cd voice-client
npm run dev
```

Opens browser at `http://localhost:5173`

## Using the Voice Assistant

1. **Click "Start Conversation"** - Grants microphone access
2. **Speak naturally** - Voice is streamed to OpenAI Realtime API
3. **AI responds with voice** - Plays through speakers
4. **Tool calls happen automatically** - Amplifier executes tools as needed

### Example Interactions

**File operations:**
- "What files are in the current directory?"
- "Create a file called test.txt with the content 'Hello World'"
- "Read the contents of test.txt"

**Web research:**
- "Search the web for the latest Python version"
- "What's the weather in Seattle?"

**Code search:**
- "Find all Python files in this project"
- "Search for the word 'Amplifier' in all files"

**Shell commands:**
- "Run 'ls -la' in the current directory"
- "What's my current git status?"

**Agent delegation:**
- "Use the explorer agent to analyze the project structure"
- "Spawn a task agent to research OpenAI's latest models"

## Architecture

```
Browser ─WebRTC─▶ FastAPI ─REST─▶ OpenAI Realtime API (voice I/O)
                     │
                     └────▶ Amplifier (tools via programmatic API)
```

**Key points:**
- OpenAI handles **all voice I/O** (speech recognition + synthesis)
- Amplifier provides **tools** (file ops, bash, web, agents, etc.)
- Backend bridges the two via programmatic API (no CLI subprocess)

## Troubleshooting

### "Amplifier bridge not initialized"

The backend couldn't load amplifier-foundation. Check:
```bash
pip list | grep amplifier
```

Should see `amplifier-foundation` installed.

### "No providers mounted"

Amplifier needs provider configuration. The voice server uses `amplifier-dev` bundle which should auto-configure, but if issues persist:

```bash
amplifier provider install anthropic -q
```

### "WebRTC connection failed"

1. Check backend is running: `http://localhost:8000/health`
2. Verify OpenAI API key is valid
3. Check browser console for errors
4. Try Chrome/Safari (best WebRTC support)

### "Tool execution timeout"

Some tools (especially web search) may take time. Default timeout is 30s. Adjust in config if needed.

### High costs

Each voice conversation costs ~$1-2 per minute with the gpt-realtime model. Strategies:
- Keep conversations under 5 minutes
- Use cheaper models for non-voice tasks
- Monitor usage at https://platform.openai.com/usage

## Development

### Backend Changes

```bash
cd voice-server
# Edit code
python -m voice_server  # Auto-reload on file changes
```

### Frontend Changes

```bash
cd voice-client
# Edit code in src/
# Vite auto-reloads in browser
```

### Add New Tools

Edit `voice_server/config.py` to configure which Amplifier bundle to use:

```python
class AmplifierSettings(BaseSettings):
    bundle: str = "amplifier-dev"  # Change to custom bundle
    cwd: str = str(Path.cwd())
```

The bridge will automatically discover and expose all tools from the bundle.

### Custom Instructions

Edit `voice_server/config.py`:

```python
instructions: str = """You are Amplifier, a helpful voice assistant.
You have access to tools for file operations, web research, and more.
Be concise in your responses since users are listening."""
```

## Next Steps

- See `ARCHITECTURE.md` for detailed system design
- See `voice-server/voice_server/config.py` for all configuration options
- Read OpenAI Realtime API docs: https://platform.openai.com/docs/guides/realtime
- Read Amplifier docs: https://github.com/microsoft/amplifier

## Cost Monitoring

Track usage in OpenAI dashboard: https://platform.openai.com/usage

**Typical costs**:
- 1-minute conversation: ~$1.14
- 5-minute conversation: ~$5.70
- 10-minute conversation: ~$11.40

Costs include:
- System instructions (cached - 90% discount)
- Tool definitions (cached - 90% discount)
- User audio input (~$0.48/min)
- Assistant audio output (~$0.64/min)

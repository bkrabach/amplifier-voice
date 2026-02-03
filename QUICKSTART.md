# Amplifier Voice Assistant - Quick Start

Get up and running with the voice assistant in 5 minutes.

## Prerequisites

- Python 3.11+
- Node.js 18+ (for client)
- OpenAI API key with Realtime API access
- Anthropic API key (for agent delegation)

## Setup

### 1. Environment Variables

Create `.env` in `voice-server/`:

```bash
# Required
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# Optional (defaults shown)
VOICE_MODEL=gpt-realtime
VOICE=ash
MAX_TURNS=10
```

### 2. Install Backend Dependencies

```bash
cd voice-server

# Create and activate virtual environment
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install package and dependencies
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
uv run voice-server
```

You should see:
```
INFO: Initializing Amplifier bridge...
INFO: Adding tool-delegate module to bundle
INFO: Amplifier bridge initialized with 1 tool (delegate)
INFO: Service lifespan started
INFO: Uvicorn running on http://0.0.0.0:8080
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

**Agent delegation (the main way to get things done):**
- "Explore my current directory" → Delegates to foundation:explorer
- "Research the latest Anthropic best practices" → Delegates to foundation:web-research
- "Design a caching system for my app" → Delegates to foundation:zen-architect
- "Fix the bug in my authentication code" → Delegates to foundation:bug-hunter

## Architecture

```
Browser ─WebRTC─▶ FastAPI ─REST─▶ OpenAI Realtime API (voice I/O)
                     │
                     └────▶ Amplifier (delegate tool → specialist agents)
```

**Key points:**
- OpenAI Realtime handles **voice I/O** (speech recognition + synthesis)
- Voice model has ONE tool: `delegate` - sends work to specialist agents
- Agents (explorer, architect, builder, etc.) run via Anthropic Claude
- Backend bridges OpenAI voice + Amplifier agents via programmatic API

## Troubleshooting

### "Amplifier bridge not initialized"

The backend couldn't load amplifier-foundation. Check:
```bash
pip list | grep amplifier
```

Should see `amplifier-foundation` installed.

### "ANTHROPIC_API_KEY not set"

The delegate tool spawns agents that run on Anthropic Claude. Set the API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
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

The voice assistant uses the `amplifier-dev` bundle by default, which includes the
`delegate` tool for agent orchestration. The bundle is configured in `voice_server/config.py`.

Available agents for delegation:
- `foundation:explorer` - Explore codebases, find files
- `foundation:zen-architect` - Design systems, review architecture
- `foundation:modular-builder` - Write code, implement features
- `foundation:bug-hunter` - Debug issues, fix errors
- `foundation:git-ops` - Git commits, PRs, branch management
- `foundation:web-research` - Search the web, gather information

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

# Configuration Reference

Complete reference for all configurable options in Amplifier Voice.

## Quick Reference

| Category | Env Prefix | Config File |
|----------|------------|-------------|
| Server | (none) | `voice_server/config.py` |
| OpenAI/Realtime | `OPENAI_` | `voice_server/config.py` |
| Amplifier | `AMPLIFIER_` | `voice_server/config.py` |
| Home Assistant | `HA_` | `homeassistant_tool/config.py` |
| Logging | `LOG_` | `voice_server/config.py` |

---

## 1. Server Settings

HTTP server configuration for the FastAPI application.

### ServiceSettings

| Setting | Env Variable | Default | Description |
|---------|--------------|---------|-------------|
| `title` | - | `"Amplifier Voice Assistant"` | API title shown in docs |
| `version` | - | `"0.2.0"` | API version |
| `host` | - | `"0.0.0.0"` | Bind address |
| `port` | - | `8080` | HTTP port |
| `allowed_origins` | - | See below | CORS allowed origins |

**Default CORS Origins:**
```python
[
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5174",
    "http://localhost:5174",
]
```

**Usage:**
```python
from voice_server.config import Settings
settings = Settings()
print(settings.service.port)  # 8080
```

---

## 2. OpenAI Realtime Settings

Configuration for OpenAI Realtime API (voice I/O).

### RealtimeSettings

| Setting | Env Variable | Default | Valid Values | Description |
|---------|--------------|---------|--------------|-------------|
| `openai_api_key` | `OPENAI_API_KEY` | (required) | Valid API key | OpenAI API key |
| `model` | - | `"gpt-realtime"` | See models below | Realtime model |
| `voice` | - | `"marin"` | See voices below | Default voice |
| `instructions` | - | See below | Any string | System instructions |

### Available Models

| Model | Description |
|-------|-------------|
| `gpt-realtime` | Latest GA model (recommended) |
| `gpt-realtime-2025-08-28` | Pinned version |

### Available Voices

| Voice | Type | Description |
|-------|------|-------------|
| `alloy` | Standard | Neutral, balanced |
| `ash` | Standard | Warm, conversational |
| `ballad` | Standard | Expressive, melodic |
| `coral` | Standard | Clear, professional |
| `echo` | Standard | Resonant, authoritative |
| `sage` | Standard | Calm, thoughtful |
| `shimmer` | Standard | Bright, energetic |
| `verse` | Standard | Articulate, precise |
| `cedar` | GA Exclusive | Natural, grounded |
| `marin` | GA Exclusive | Friendly, approachable |

### Default Instructions

```
You are Amplifier, a powerful voice assistant backed by specialist AI agents.
Talk quickly and be extremely succinct. Be friendly and conversational.

YOU ARE AN ORCHESTRATOR. You have ONE tool:
- task: Delegate ALL work to specialist agents

DELEGATION IS YOUR ONLY WAY TO DO THINGS:
When the user asks you to DO something (not just chat), IMMEDIATELY use the
task tool to delegate. Don't try to do things yourself - delegate!

Available agents include:
- foundation:explorer - Explore codebases, find files, understand structure
- foundation:zen-architect - Design systems, review architecture
- foundation:modular-builder - Write code, implement features
- foundation:bug-hunter - Debug issues, fix errors
- foundation:git-ops - Git commits, PRs, branch management
- foundation:web-research - Search the web, fetch information

WORKFLOW:
1. Clarify what the user wants (keep it brief)
2. Use task to delegate to the right agent - DO THIS IMMEDIATELY
3. Summarize results conversationally

VOICE INTERACTION:
- Keep responses SHORT - you're on a voice call, not writing an essay
- Summarize agent results, don't read raw output
- For technical identifiers, spell them out: "j d o e 1 2 3"
- Confirm important actions before delegating

You operate in a working directory where agents can create files, run code,
and build projects. Think of yourself as the friendly voice interface to a
team of expert AI agents ready to help.
```

---

## 3. Amplifier Integration Settings

Configuration for Microsoft Amplifier tool execution.

### AmplifierSettings

| Setting | Env Variable | Default | Valid Values | Description |
|---------|--------------|---------|--------------|-------------|
| `bundle` | `AMPLIFIER_BUNDLE` | `"amplifier-dev"` | Bundle name/path | Amplifier bundle to load |
| `cwd` | `AMPLIFIER_CWD` | `~/amplifier-working` | Directory path | Working directory for tools |
| `auto_approve` | `AMPLIFIER_AUTO_APPROVE` | `true` | `true`/`false` | Auto-approve tool executions |
| `tool_timeout` | - | `60.0` | Seconds (float) | Tool execution timeout |
| `tools` | - | See below | List of tool names | Tools to enable |
| `custom_bundle_path` | - | `bundles/voice.yaml` | File path | Custom bundle config |
| `approval_policy` | - | `"auto_approve"` | See policies below | Approval policy |

### Default Tools

```python
[
    "tool-filesystem",
    "tool-bash",
    "tool-web",
]
```

### Approval Policies

| Policy | Description |
|--------|-------------|
| `auto_approve` | All tools run without confirmation |
| `safe_only` | Only safe tools auto-approve |
| `confirm_dangerous` | Dangerous operations require confirmation |
| `always_ask` | All tools require confirmation |

### Provider Configuration

The Amplifier bridge automatically configures Anthropic as a provider if `ANTHROPIC_API_KEY` is set:

| Env Variable | Required | Description |
|--------------|----------|-------------|
| `ANTHROPIC_API_KEY` | For agent delegation | Claude API key for task tool |

**Provider Configuration (automatic):**
```python
{
    "module": "provider-anthropic",
    "source": "git+https://github.com/microsoft/amplifier-module-provider-anthropic@main",
    "config": {
        "priority": 1,
        "default_model": "claude-opus-4-5-20251101",
    }
}
```

---

## 4. Audio Settings

Audio configuration is handled by OpenAI Realtime API. Voice and turn detection are configured client-side after WebRTC connection (GA API restriction).

### Voice Activity Detection (VAD)

VAD is configured via client-side `session.update` after connection:

```javascript
// Client-side configuration example
session.update({
    turn_detection: {
        type: "server_vad",
        threshold: 0.5,           // 0.0-1.0, sensitivity
        prefix_padding_ms: 300,   // Audio before speech
        silence_duration_ms: 500, // Silence to end turn
    }
});
```

| Setting | Default | Range | Description |
|---------|---------|-------|-------------|
| `type` | `"server_vad"` | `"server_vad"` | VAD type |
| `threshold` | `0.5` | 0.0-1.0 | Speech detection sensitivity |
| `prefix_padding_ms` | `300` | ms | Audio captured before detected speech |
| `silence_duration_ms` | `500` | ms | Silence duration to end turn |

### Audio Format

| Setting | Value | Description |
|---------|-------|-------------|
| Input Format | PCM 16-bit | 24kHz mono |
| Output Format | PCM 16-bit | 24kHz mono |
| Transport | WebRTC | Real-time audio streaming |

---

## 5. Session Settings

Voice session and transcript storage configuration.

### TranscriptRepository

| Setting | Default | Description |
|---------|---------|-------------|
| `storage_dir` | `~/.amplifier-voice/sessions` | Transcript storage location |

### Storage Structure

```
~/.amplifier-voice/sessions/
├── sessions.json              # Session index
└── {session_id}/
    ├── session.json           # Session metadata
    └── transcript.jsonl       # Transcript entries (append-only)
```

### Session Limits

| Setting | Default | Description |
|---------|---------|-------------|
| `max_entries` (resumption) | `30` | Max entries for context injection |
| `limit` (list sessions) | `20` | Default session list limit |

---

## 6. Security Settings

### API Keys (Required)

| Env Variable | Required | Description |
|--------------|----------|-------------|
| `OPENAI_API_KEY` | **Yes** | OpenAI API key for Realtime API |
| `ANTHROPIC_API_KEY` | For agents | Claude API key for task delegation |

### SSL/TLS (Home Assistant)

| Setting | Env Variable | Default | Description |
|---------|--------------|---------|-------------|
| `use_ssl` | `HA_USE_SSL` | `false` | Enable HTTPS/WSS |
| `ssl_verify` | `HA_SSL_VERIFY` | `true` | Verify SSL certificates |
| `ssl_cert_path` | `HA_SSL_CERT_PATH` | `null` | Custom CA certificate path |

### CORS Security

Default allowed origins are localhost only. For production, configure `allowed_origins` in `ServiceSettings`.

### Token Security

- Access tokens are stored as `SecretStr` (Pydantic) to prevent accidental logging
- Never commit `.env` files with real tokens
- Use environment variables or secure secret management

---

## 7. Home Assistant Integration

Optional integration for smart home control.

### HomeAssistantConfig

| Setting | Env Variable | Default | Valid Values | Description |
|---------|--------------|---------|--------------|-------------|
| `host` | `HA_HOST` | `"localhost"` | IP/hostname | Home Assistant host |
| `port` | `HA_PORT` | `8123` | 1-65535 | Home Assistant port |
| `access_token` | `HA_ACCESS_TOKEN` | (required) | Long-lived token | Authentication token |
| `use_ssl` | `HA_USE_SSL` | `false` | `true`/`false` | Use HTTPS/WSS |
| `ssl_verify` | `HA_SSL_VERIFY` | `true` | `true`/`false` | Verify SSL certs |
| `ssl_cert_path` | `HA_SSL_CERT_PATH` | `null` | File path | Custom CA cert |
| `connection_timeout` | `HA_CONNECTION_TIMEOUT` | `10.0` | ≥1.0 seconds | Connection timeout |
| `request_timeout` | `HA_REQUEST_TIMEOUT` | `30.0` | ≥1.0 seconds | Request timeout |
| `websocket_heartbeat` | `HA_WEBSOCKET_HEARTBEAT` | `30.0` | ≥5.0 seconds | WS heartbeat interval |
| `max_retries` | `HA_MAX_RETRIES` | `3` | 0-10 | Max retry attempts |
| `retry_delay` | `HA_RETRY_DELAY` | `1.0` | ≥0.1 seconds | Delay between retries |

### Generating Access Token

1. Go to Home Assistant → Profile → Security
2. Create Long-Lived Access Token
3. Copy token immediately (shown only once)
4. Set as `HA_ACCESS_TOKEN` environment variable

---

## 8. Logging Settings

### LoggingSettings

| Setting | Env Variable | Default | Valid Values | Description |
|---------|--------------|---------|--------------|-------------|
| Log Level | `LOG_LEVEL` | `"INFO"` | `DEBUG`, `INFO`, `WARNING`, `ERROR` | Logging verbosity |

### Log Format

```
%(levelprefix)s %(message)s
```

Example output:
```
INFO:     Amplifier bridge initialized with 5 tools
DEBUG:    Tool task completed successfully
WARNING:  ANTHROPIC_API_KEY not set - task tool delegation will not work
```

---

## Environment File Template

Create a `.env` file in `voice-server/`:

```bash
# =============================================================================
# REQUIRED
# =============================================================================

# OpenAI API key (required for voice I/O)
OPENAI_API_KEY=sk-...

# Anthropic API key (required for agent delegation)
ANTHROPIC_API_KEY=sk-ant-...

# =============================================================================
# AMPLIFIER SETTINGS
# =============================================================================

# Bundle to load (default: amplifier-dev)
AMPLIFIER_BUNDLE=amplifier-dev

# Working directory for tool execution
AMPLIFIER_CWD=~/amplifier-working

# Auto-approve tool executions (default: true)
AMPLIFIER_AUTO_APPROVE=true

# =============================================================================
# LOGGING
# =============================================================================

# Log level: DEBUG, INFO, WARNING, ERROR
LOG_LEVEL=INFO

# =============================================================================
# HOME ASSISTANT (Optional)
# =============================================================================

# HA_ACCESS_TOKEN=your_long_lived_token
# HA_HOST=homeassistant.local
# HA_PORT=8123
# HA_USE_SSL=false
```

---

## Configuration Precedence

1. **Environment variables** (highest priority)
2. **`.env` file** in working directory
3. **Default values** in config classes

---

## Validation

All configuration is validated using Pydantic:

- Type checking (string, int, float, bool)
- Range validation (ports 1-65535, timeouts ≥1.0)
- Required field enforcement
- Custom validators (host cleanup, SSL consistency)

**Example validation errors:**
```
ConfigurationError: Invalid configuration: Port must be between 1 and 65535
ConfigurationError: Access token not found. Set HA_ACCESS_TOKEN environment variable
ConfigurationError: ssl_cert_path requires use_ssl=True
```

---

## Runtime Configuration

Some settings can be changed at runtime via API:

| Endpoint | Method | Settings |
|----------|--------|----------|
| `/session` | POST | `voice` parameter |
| `/sessions/{id}/resume` | POST | `voice` parameter |

Client-side session update (after WebRTC connection):
- Voice selection
- Turn detection settings
- Transcription settings

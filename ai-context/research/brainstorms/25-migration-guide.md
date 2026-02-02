# Migration Guide for Amplifier Voice

**Document Version:** 1.0  
**Last Updated:** January 31, 2026  
**Applies to:** amplifier-voice v0.2.0+

---

## Table of Contents

1. [Overview](#1-overview)
2. [Updating OpenAI Model Versions](#2-updating-openai-model-versions)
3. [Adding New Tools to Voice](#3-adding-new-tools-to-voice)
4. [Swapping Voice Models/Providers](#4-swapping-voice-modelsproviders)
5. [Upgrading Amplifier Integration](#5-upgrading-amplifier-integration)
6. [Migrating Session Storage](#6-migrating-session-storage)
7. [Handling Breaking API Changes](#7-handling-breaking-api-changes)
8. [Version Compatibility Matrices](#8-version-compatibility-matrices)
9. [Migration Checklists](#9-migration-checklists)
10. [Rollback Procedures](#10-rollback-procedures)

---

## 1. Overview

This guide documents how to upgrade and migrate various components of the Amplifier Voice system. The architecture consists of four main integration points:

```
┌─────────────────────────────────────────────────────────────┐
│                    Amplifier Voice                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   OpenAI    │  │  Amplifier  │  │  Session Storage    │ │
│  │  Realtime   │  │  Foundation │  │  (Transcripts)      │ │
│  │    API      │  │   Library   │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │                │                    │             │
│    Models/Voices    Tools/Agents       JSON/SQLite         │
└─────────────────────────────────────────────────────────────┘
```

### Key Files for Migration

| Component | Primary Files |
|-----------|---------------|
| OpenAI Models | `voice_server/config.py`, `voice_server/realtime.py` |
| Tools | `voice_server/amplifier_bridge.py`, `bundles/voice.yaml` |
| Voice/Providers | `voice_server/config.py`, `voice_client/src/hooks/useWebRTC.ts` |
| Amplifier | `pyproject.toml`, `voice_server/amplifier_bridge.py` |
| Session Storage | `voice_server/transcript/repository.py`, `transcript/models.py` |

---

## 2. Updating OpenAI Model Versions

### 2.1 Current Configuration

The model is configured in `voice_server/config.py`:

```python
class RealtimeSettings(BaseSettings):
    # Use GA model with prompt caching (90% cost savings on system/tools)
    # Options: "gpt-realtime" (latest) or "gpt-realtime-2025-08-28" (pinned)
    model: str = "gpt-realtime"
```

### 2.2 Model Migration Paths

#### Beta to GA Migration (Already Completed)

```diff
# config.py
- model: str = "gpt-4o-realtime-preview-2024-12-17"
+ model: str = "gpt-realtime"
```

**GA API Changes Applied:**

| Change | Beta | GA |
|--------|------|-------|
| Session endpoint | `/v1/realtime/sessions` | `/v1/realtime/client_secrets` |
| SDP endpoint | `/v1/realtime?model=...` | `/v1/realtime/calls` |
| Session structure | `{model, voice, tools}` | `{session: {type: "realtime", ...}}` |
| Response format | `{client_secret: {value}}` | `{value: "ek_..."}` |

#### Future Model Upgrades

**Step 1: Update config.py**

```python
class RealtimeSettings(BaseSettings):
    # Pin to specific version for stability
    model: str = "gpt-realtime-2025-08-28"  # Or latest: "gpt-realtime"
```

**Step 2: Test with environment variable override**

```bash
# Test new model without code changes
export OPENAI_MODEL="gpt-realtime-2026-XX-XX"
python -m voice_server.start
```

**Step 3: Update realtime.py if API structure changes**

```python
# Check for new required fields in session config
session_config = {
    "session": {
        "type": "realtime",
        "model": settings.realtime.model,
        "instructions": settings.realtime.instructions,
        "tools": available_tools,
        # Add new fields as required by updated API
    }
}
```

### 2.3 Model Version Strategy

```python
# Recommended: Environment-based model selection
import os

class RealtimeSettings(BaseSettings):
    # Default to latest, allow override for testing
    model: str = os.environ.get("OPENAI_MODEL", "gpt-realtime")
    
    # Pin specific version for production stability
    # model: str = "gpt-realtime-2025-08-28"
```

### 2.4 Migration Verification

```bash
# Health check should show new model
curl http://localhost:8080/health | jq '.model'

# Expected output:
# "gpt-realtime"
```

---

## 3. Adding New Tools to Voice

### 3.1 Architecture Overview

Tools flow through these layers:

```
Amplifier Bundle → AmplifierBridge → OpenAI Session
     (yaml)           (discover)        (function format)
```

### 3.2 Adding Tools via Bundle Configuration

**Option A: Use amplifier-dev bundle (default)**

All tools are automatically available via `amplifier-dev`:

```python
# config.py
amplifier_bundle = os.environ.get("AMPLIFIER_BUNDLE", "amplifier-dev")
```

**Option B: Custom voice.yaml bundle**

```yaml
# voice_server/bundles/voice.yaml
name: amplifier-voice
version: 1.0.0

tools:
  - module: tool-task
    config:
      timeout: 120

  - module: tool-filesystem
    config:
      allowed_paths:
        - ~/amplifier-working

  # Add new tool
  - module: tool-my-custom
    source: git+https://github.com/myorg/amplifier-tool-custom@main
    config:
      api_key: ${MY_API_KEY}
```

### 3.3 Exposing Tools to Voice Model

By default, only orchestration tools are exposed to the realtime model:

```python
# amplifier_bridge.py
class AmplifierBridge:
    # Tools to expose to the realtime model
    # Only task tool - forces ALL work to be delegated to agents
    REALTIME_TOOLS = {"task"}
```

**To expose additional tools directly:**

```python
# amplifier_bridge.py
REALTIME_TOOLS = {
    "task",           # Agent delegation
    "home_assistant", # Direct smart home control
    "calendar",       # Direct calendar access
}
```

### 3.4 Adding a Custom Tool Module

**Step 1: Create tool module structure**

```
my_custom_tool/
├── __init__.py
├── tool.py
└── pyproject.toml
```

**Step 2: Implement tool protocol**

```python
# my_custom_tool/tool.py
from typing import Any, Dict

class MyCustomTool:
    name = "my_custom_tool"
    description = "Description for the AI model"
    
    input_schema = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The query parameter"
            }
        },
        "required": ["query"]
    }
    
    async def execute(self, arguments: Dict[str, Any]) -> Any:
        query = arguments.get("query")
        # Tool implementation
        return {"result": f"Processed: {query}"}
```

**Step 3: Register in bundle**

```yaml
# bundles/voice.yaml
tools:
  - module: my-custom-tool
    source: ./my_custom_tool  # Local path or git URL
```

### 3.5 Tool Migration Checklist

- [ ] Tool implements required protocol (name, description, input_schema, execute)
- [ ] Tool added to bundle configuration
- [ ] Tool appears in `/tools` endpoint response
- [ ] Tool functions correctly via `/execute/{tool_name}` endpoint
- [ ] Tool works when called by voice model
- [ ] Add to `REALTIME_TOOLS` if direct voice access needed

---

## 4. Swapping Voice Models/Providers

### 4.1 Current Voice Configuration

**Server-side (session creation):**

```python
# config.py
class RealtimeSettings(BaseSettings):
    # Available: alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar
    voice: str = "marin"
```

**Client-side (session update after connection):**

```typescript
// useWebRTC.ts
const sessionUpdate = {
    type: 'session.update',
    session: {
        type: 'realtime',
        audio: {
            input: {
                noise_reduction: { type: 'near_field' },
                transcription: { model: 'gpt-4o-transcribe', language: 'en' },
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500
                }
            }
        }
    }
};
```

### 4.2 Changing OpenAI Voices

**Available GA voices:**

| Voice | Characteristics | Best For |
|-------|-----------------|----------|
| `marin` | Clear, professional | Assistants (recommended) |
| `cedar` | Warm, conversational | Customer service |
| `alloy` | Neutral, balanced | General purpose |
| `ash` | Calm, measured | Technical support |
| `coral` | Friendly, upbeat | Sales, marketing |
| `sage` | Authoritative | Education, training |
| `shimmer` | Energetic | Entertainment |
| `verse` | Expressive | Creative content |

**To change voice:**

```python
# config.py
class RealtimeSettings(BaseSettings):
    voice: str = "cedar"  # Change default voice
```

Or via environment:

```bash
export VOICE_DEFAULT="cedar"
```

**Note:** Voice cannot be changed mid-session after first audio output.

### 4.3 Swapping to Alternative Voice Providers

For future provider swaps (e.g., ElevenLabs, Azure Speech), create an abstraction layer:

**Step 1: Define voice provider interface**

```python
# voice_server/providers/base.py
from abc import ABC, abstractmethod
from typing import Dict, Any

class VoiceProvider(ABC):
    @abstractmethod
    async def create_session(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Create a voice session and return connection details."""
        pass
    
    @abstractmethod
    async def exchange_sdp(self, offer: bytes, auth: str) -> str:
        """Exchange SDP for WebRTC connection."""
        pass
    
    @property
    @abstractmethod
    def supported_voices(self) -> list[str]:
        """List of supported voice IDs."""
        pass
```

**Step 2: Implement OpenAI provider (current)**

```python
# voice_server/providers/openai_realtime.py
from .base import VoiceProvider

class OpenAIRealtimeProvider(VoiceProvider):
    supported_voices = ["marin", "cedar", "alloy", "ash", "coral", "sage", "shimmer", "verse"]
    
    async def create_session(self, config):
        # Current implementation from realtime.py
        pass
    
    async def exchange_sdp(self, offer, auth):
        # Current implementation
        pass
```

**Step 3: Implement alternative provider**

```python
# voice_server/providers/elevenlabs.py
class ElevenLabsProvider(VoiceProvider):
    supported_voices = ["rachel", "drew", "clyde", ...]
    
    async def create_session(self, config):
        # ElevenLabs-specific session creation
        pass
```

**Step 4: Provider factory**

```python
# voice_server/providers/__init__.py
def get_voice_provider(provider_name: str) -> VoiceProvider:
    providers = {
        "openai": OpenAIRealtimeProvider,
        "elevenlabs": ElevenLabsProvider,
        "azure": AzureSpeechProvider,
    }
    return providers[provider_name]()
```

### 4.4 VAD and Transcription Model Changes

**Change VAD type:**

```typescript
// useWebRTC.ts
turn_detection: {
    type: 'semantic_vad',  // 'server_vad' or 'semantic_vad'
    eagerness: 'medium',   // 'low', 'medium', 'high', 'auto'
    create_response: true,
    interrupt_response: true
}
```

**Change transcription model:**

```typescript
transcription: {
    model: 'gpt-4o-transcribe',  // or 'whisper-1'
    language: 'en'  // ISO 639-1 code
}
```

---

## 5. Upgrading Amplifier Integration

### 5.1 Current Integration

```toml
# pyproject.toml
dependencies = [
    "amplifier-foundation @ git+https://github.com/microsoft/amplifier-foundation@main",
]
```

### 5.2 Upgrade Process

**Step 1: Update dependency version**

```toml
# Pin to specific version
"amplifier-foundation @ git+https://github.com/microsoft/amplifier-foundation@v1.2.0",

# Or use latest main
"amplifier-foundation @ git+https://github.com/microsoft/amplifier-foundation@main",
```

**Step 2: Reinstall dependencies**

```bash
cd voice-server
uv sync --reinstall-package amplifier-foundation
```

**Step 3: Check for API changes**

```python
# amplifier_bridge.py - Common upgrade points

# Bundle loading (check if API changed)
from amplifier_foundation import load_bundle
bundle = await load_bundle(self._bundle_name)

# Session creation (check for new parameters)
self._session = await self._prepared.create_session(session_cwd=self._cwd)

# Tool discovery (check for protocol changes)
tools_dict = self._coordinator.get("tools")
```

### 5.3 Provider Configuration Updates

When upgrading, check for provider changes:

```python
# amplifier_bridge.py
bundle.providers.append({
    "module": "provider-anthropic",
    "source": "git+https://github.com/microsoft/amplifier-module-provider-anthropic@main",
    "config": {
        "priority": 1,
        "default_model": "claude-opus-4-5-20251101",  # Check for model updates
    },
})
```

### 5.4 Spawn Capability Updates

The spawn capability may need updates for new Amplifier versions:

```python
# Check for new parameters in spawn signature
async def spawn_capability(
    agent_name: str,
    instruction: str,
    parent_session: Any,
    agent_configs: Dict[str, Dict[str, Any]],
    sub_session_id: Optional[str] = None,
    tool_inheritance: Optional[Dict[str, Any]] = None,
    hook_inheritance: Optional[Dict[str, Any]] = None,
    orchestrator_config: Optional[Dict[str, Any]] = None,
    provider_preferences: Optional[List[Any]] = None,
    parent_messages: Optional[List[Dict[str, Any]]] = None,
    # NEW PARAMETERS may be added here
) -> Dict[str, Any]:
```

### 5.5 Upgrade Testing

```bash
# Run startup test
python test_startup.py

# Verify tools load correctly
curl http://localhost:8080/tools | jq '.count'

# Test tool execution
curl -X POST http://localhost:8080/execute/task \
  -H "Content-Type: application/json" \
  -d '{"instruction": "List files in current directory", "agent": "foundation:explorer"}'
```

---

## 6. Migrating Session Storage

### 6.1 Current Storage (JSON Files)

```
~/.amplifier-voice/sessions/
├── sessions.json           # Index of all sessions
├── {session_id}/
│   ├── session.json        # Session metadata
│   └── transcript.jsonl    # Transcript entries (append-only)
```

### 6.2 Migration to SQLite

**Step 1: Create SQLite schema**

```python
# voice_server/transcript/sqlite_repository.py
import sqlite3
from pathlib import Path

class SQLiteTranscriptRepository:
    def __init__(self, db_path: str = None):
        if db_path is None:
            db_path = Path.home() / ".amplifier-voice" / "sessions.db"
        
        self._conn = sqlite3.connect(db_path)
        self._create_tables()
    
    def _create_tables(self):
        self._conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT,
                status TEXT DEFAULT 'active',
                created_at TEXT,
                updated_at TEXT,
                message_count INTEGER DEFAULT 0,
                tool_call_count INTEGER DEFAULT 0,
                first_message TEXT,
                last_message TEXT
            );
            
            CREATE TABLE IF NOT EXISTS transcript_entries (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                entry_type TEXT NOT NULL,
                text TEXT,
                tool_name TEXT,
                tool_call_id TEXT,
                tool_arguments TEXT,
                tool_result TEXT,
                audio_duration_ms INTEGER,
                timestamp TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_entries_session 
                ON transcript_entries(session_id);
            CREATE INDEX IF NOT EXISTS idx_sessions_status 
                ON sessions(status);
        """)
        self._conn.commit()
```

**Step 2: Create migration script**

```python
# scripts/migrate_json_to_sqlite.py
import json
from pathlib import Path
from voice_server.transcript.sqlite_repository import SQLiteTranscriptRepository

def migrate_json_to_sqlite():
    json_dir = Path.home() / ".amplifier-voice" / "sessions"
    repo = SQLiteTranscriptRepository()
    
    # Load sessions index
    index_file = json_dir / "sessions.json"
    if not index_file.exists():
        print("No sessions to migrate")
        return
    
    with open(index_file) as f:
        index = json.load(f)
    
    for session_info in index.get("sessions", []):
        session_id = session_info["id"]
        session_dir = json_dir / session_id
        
        # Load full session
        session_file = session_dir / "session.json"
        if session_file.exists():
            with open(session_file) as f:
                session = json.load(f)
            repo.create_session_from_dict(session)
        
        # Load transcript
        transcript_file = session_dir / "transcript.jsonl"
        if transcript_file.exists():
            with open(transcript_file) as f:
                for line in f:
                    if line.strip():
                        entry = json.loads(line)
                        repo.add_entry_from_dict(entry)
        
        print(f"Migrated session: {session_id}")
    
    print(f"Migration complete: {len(index.get('sessions', []))} sessions")

if __name__ == "__main__":
    migrate_json_to_sqlite()
```

**Step 3: Update service to use SQLite**

```python
# voice_server/service.py
from .transcript.sqlite_repository import SQLiteTranscriptRepository

# In service_lifespan():
_transcript_repo = SQLiteTranscriptRepository()
```

### 6.3 Migration to External Database (PostgreSQL)

**Step 1: Add dependency**

```toml
# pyproject.toml
dependencies = [
    "asyncpg>=0.29.0",
]
```

**Step 2: Create PostgreSQL repository**

```python
# voice_server/transcript/postgres_repository.py
import asyncpg
from typing import Optional

class PostgresTranscriptRepository:
    def __init__(self, connection_string: str):
        self._dsn = connection_string
        self._pool: Optional[asyncpg.Pool] = None
    
    async def initialize(self):
        self._pool = await asyncpg.create_pool(self._dsn)
        await self._create_tables()
    
    async def _create_tables(self):
        async with self._pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS voice_sessions (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title TEXT,
                    status TEXT DEFAULT 'active',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW(),
                    message_count INTEGER DEFAULT 0,
                    tool_call_count INTEGER DEFAULT 0,
                    metadata JSONB DEFAULT '{}'
                );
                
                CREATE TABLE IF NOT EXISTS voice_transcript_entries (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    session_id UUID REFERENCES voice_sessions(id),
                    entry_type TEXT NOT NULL,
                    content JSONB NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)
```

### 6.4 Storage Backend Configuration

```python
# voice_server/config.py
class StorageSettings(BaseSettings):
    backend: str = os.environ.get("STORAGE_BACKEND", "json")  # json, sqlite, postgres
    json_path: str = str(Path.home() / ".amplifier-voice" / "sessions")
    sqlite_path: str = str(Path.home() / ".amplifier-voice" / "sessions.db")
    postgres_url: str = os.environ.get("DATABASE_URL", "")
```

```python
# voice_server/transcript/__init__.py
def get_repository(settings: StorageSettings):
    if settings.backend == "json":
        return TranscriptRepository(settings.json_path)
    elif settings.backend == "sqlite":
        return SQLiteTranscriptRepository(settings.sqlite_path)
    elif settings.backend == "postgres":
        return PostgresTranscriptRepository(settings.postgres_url)
    else:
        raise ValueError(f"Unknown storage backend: {settings.backend}")
```

---

## 7. Handling Breaking API Changes

### 7.1 OpenAI API Changes

**Common breaking changes to watch for:**

| Area | Example Change | Detection | Migration |
|------|----------------|-----------|-----------|
| Endpoints | URL path changes | HTTP 404 errors | Update endpoint constants |
| Request format | New required fields | HTTP 400 errors | Update session config |
| Response format | Field renames | KeyError exceptions | Update response parsing |
| Authentication | Token format changes | HTTP 401 errors | Update auth handling |

**Example: Beta to GA endpoint migration**

```python
# realtime.py - Before (Beta)
SESSIONS_ENDPOINT = "https://api.openai.com/v1/realtime/sessions"
SDP_ENDPOINT = "https://api.openai.com/v1/realtime"

# realtime.py - After (GA)
CLIENT_SECRETS_ENDPOINT = "https://api.openai.com/v1/realtime/client_secrets"
SDP_EXCHANGE_ENDPOINT = "https://api.openai.com/v1/realtime/calls"
```

### 7.2 API Version Detection

```python
# realtime.py
import httpx

async def detect_api_version() -> str:
    """Detect which API version is available."""
    headers = {"Authorization": f"Bearer {settings.realtime.openai_api_key}"}
    
    async with httpx.AsyncClient() as client:
        # Try GA endpoint first
        resp = await client.post(
            "https://api.openai.com/v1/realtime/client_secrets",
            json={"session": {"type": "realtime", "model": "gpt-realtime"}},
            headers=headers
        )
        if resp.status_code != 404:
            return "ga"
        
        # Fall back to beta
        return "beta"

# Use version-specific logic
API_VERSION = None

async def create_realtime_session(...):
    global API_VERSION
    if API_VERSION is None:
        API_VERSION = await detect_api_version()
    
    if API_VERSION == "ga":
        return await _create_session_ga(...)
    else:
        return await _create_session_beta(...)
```

### 7.3 Amplifier API Changes

**Monitor for changes in:**

```python
# Key integration points
from amplifier_foundation import load_bundle  # Package import
bundle = await load_bundle(name)              # Bundle loading
prepared = await bundle.prepare()             # Module resolution
session = await prepared.create_session()    # Session creation
coordinator = session.coordinator            # Tool access
result = await tool.execute(arguments)       # Tool execution
```

**Defensive coding pattern:**

```python
async def _discover_tools(self):
    # Try new API first, fall back to old
    try:
        tools_dict = self._coordinator.get("tools")
    except AttributeError:
        # Fall back to old API
        tools_dict = self._coordinator._tools
    
    if not tools_dict:
        # Try alternative access pattern
        tools_dict = getattr(self._session, "tools", {})
```

### 7.4 Client-Side API Changes

**WebRTC data channel message format changes:**

```typescript
// useWebRTC.ts - Handle multiple event formats
dataChannel.onmessage = (e) => {
    const data = JSON.parse(e.data);
    
    // Handle both old and new event type naming
    const eventType = data.type || data.event_type || 'unknown';
    
    // Handle field renames
    const content = data.content || data.text || data.message;
    
    onMessage(eventType, content);
};
```

---

## 8. Version Compatibility Matrices

### 8.1 OpenAI Realtime API Versions

| Feature | Beta (Preview) | GA (Aug 2025+) |
|---------|----------------|----------------|
| Model name | `gpt-4o-realtime-preview` | `gpt-realtime` |
| Session endpoint | `/v1/realtime/sessions` | `/v1/realtime/client_secrets` |
| SDP endpoint | `/v1/realtime?model=...` | `/v1/realtime/calls` |
| Max session duration | 30 minutes | 60 minutes |
| Prompt caching | Limited | Full (90% savings) |
| Semantic VAD | No | Yes |
| Image input | No | Yes |
| Temperature control | Yes (0.6-1.2) | No (fixed) |
| Response format | `{client_secret: {value}}` | `{value: "..."}` |

### 8.2 Voice Compatibility

| Voice | Beta | GA | Recommended Use |
|-------|------|----|-----------------| 
| alloy | Yes | Yes | General |
| ash | Yes | Yes | Technical |
| ballad | Yes | Yes | Narrative |
| coral | Yes | Yes | Friendly |
| echo | Yes | Yes | Calm |
| sage | Yes | Yes | Authoritative |
| shimmer | Yes | Yes | Energetic |
| verse | Yes | Yes | Expressive |
| marin | No | Yes | **Recommended** |
| cedar | No | Yes | Warm |

### 8.3 Python Version Compatibility

| Component | Python 3.10 | Python 3.11 | Python 3.12 | Python 3.13 |
|-----------|-------------|-------------|-------------|-------------|
| voice-server | Limited | **Recommended** | Yes | Testing |
| amplifier-foundation | No | **Required** | Yes | Testing |
| FastAPI | Yes | Yes | Yes | Yes |
| httpx | Yes | Yes | Yes | Yes |

### 8.4 Amplifier Foundation Versions

| amplifier-foundation | voice-server | Breaking Changes |
|---------------------|--------------|------------------|
| 0.1.x | v0.1.x | Initial release |
| 0.2.x | v0.2.x | Provider config format |
| 1.0.x (future) | v0.3.x+ | TBD |

### 8.5 Client Compatibility

| Browser | WebRTC | Audio | Recommended |
|---------|--------|-------|-------------|
| Chrome 90+ | Full | Excellent | **Yes** |
| Safari 15+ | Full | Good | Yes |
| Firefox 90+ | Partial | Poor echo cancellation | Limited |
| Edge 90+ | Full | Excellent | Yes |

---

## 9. Migration Checklists

### 9.1 OpenAI Model Upgrade Checklist

- [ ] Review OpenAI changelog for API changes
- [ ] Update `model` in `config.py`
- [ ] Test session creation with new model
- [ ] Verify tool calling still works
- [ ] Test voice output quality
- [ ] Update session config if new fields required
- [ ] Update client-side session.update if needed
- [ ] Run full conversation test
- [ ] Monitor for new rate limits or pricing

### 9.2 Amplifier Upgrade Checklist

- [ ] Review amplifier-foundation release notes
- [ ] Update version in `pyproject.toml`
- [ ] Run `uv sync --reinstall-package amplifier-foundation`
- [ ] Test bundle loading
- [ ] Verify tool discovery
- [ ] Test tool execution
- [ ] Verify spawn capability works
- [ ] Test agent delegation
- [ ] Run integration tests

### 9.3 Storage Migration Checklist

- [ ] Create new storage backend implementation
- [ ] Write migration script
- [ ] Backup existing data
- [ ] Run migration in test environment
- [ ] Verify data integrity
- [ ] Update service configuration
- [ ] Test session creation/retrieval
- [ ] Test transcript recording
- [ ] Test session resumption
- [ ] Deploy to production

### 9.4 Voice Provider Change Checklist

- [ ] Implement new provider interface
- [ ] Add provider configuration
- [ ] Update session creation endpoint
- [ ] Update SDP exchange if needed
- [ ] Test WebRTC connection
- [ ] Verify audio quality
- [ ] Test all available voices
- [ ] Update client if protocol differs
- [ ] Document new voice options

---

## 10. Rollback Procedures

### 10.1 Quick Rollback via Environment

```bash
# Rollback to previous model
export OPENAI_MODEL="gpt-4o-realtime-preview-2024-12-17"

# Rollback to previous voice
export VOICE_DEFAULT="ash"

# Restart server
systemctl restart amplifier-voice
```

### 10.2 Code Rollback

```bash
# Identify last working commit
git log --oneline -10

# Rollback to specific commit
git checkout <commit-hash> -- voice_server/config.py
git checkout <commit-hash> -- voice_server/realtime.py

# Or full rollback
git revert HEAD
```

### 10.3 Dependency Rollback

```bash
# Pin to previous amplifier version
# Edit pyproject.toml to specific version

# Reinstall
uv sync --reinstall
```

### 10.4 Storage Rollback

```bash
# Keep backup before migration
cp -r ~/.amplifier-voice/sessions ~/.amplifier-voice/sessions.backup

# Rollback storage backend
export STORAGE_BACKEND="json"

# Restore from backup if needed
rm -rf ~/.amplifier-voice/sessions
mv ~/.amplifier-voice/sessions.backup ~/.amplifier-voice/sessions
```

### 10.5 Emergency Procedures

**If voice is completely broken:**

1. Check OpenAI status: https://status.openai.com
2. Verify API key is valid
3. Test with minimal configuration
4. Check network connectivity
5. Review server logs for errors

**Minimal recovery configuration:**

```python
# config.py - Minimal safe configuration
class RealtimeSettings(BaseSettings):
    model: str = "gpt-realtime"
    voice: str = "alloy"  # Most stable voice
    instructions: str = "You are a helpful assistant."
```

---

## Appendix A: Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | Required | OpenAI API key |
| `OPENAI_MODEL` | `gpt-realtime` | Model to use |
| `VOICE_DEFAULT` | `marin` | Default voice |
| `AMPLIFIER_BUNDLE` | `amplifier-dev` | Bundle name |
| `AMPLIFIER_CWD` | `~/amplifier-working` | Working directory |
| `ANTHROPIC_API_KEY` | Optional | For agent delegation |
| `STORAGE_BACKEND` | `json` | Storage type |
| `DATABASE_URL` | Optional | PostgreSQL connection |
| `LOG_LEVEL` | `INFO` | Logging verbosity |

---

## Appendix B: Troubleshooting

### Common Issues After Migration

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| 404 on /session | Endpoint changed | Update endpoint URLs |
| No audio output | Voice config missing | Send session.update after connect |
| Tools not working | Amplifier version mismatch | Update bridge code |
| Session timeout | Duration limit changed | Implement reconnection |
| Text-only responses | History loading bug | Add audio message first |

### Diagnostic Commands

```bash
# Check server health
curl http://localhost:8080/health | jq

# List available tools
curl http://localhost:8080/tools | jq

# Test session creation
curl -X POST http://localhost:8080/session \
  -H "Content-Type: application/json" \
  -d '{"voice": "marin"}' | jq

# Check Amplifier logs
tail -f /var/log/amplifier-voice/server.log | grep -i amplifier
```

---

**Document Maintainer:** Amplifier Voice Team  
**Review Schedule:** Update with each major component upgrade

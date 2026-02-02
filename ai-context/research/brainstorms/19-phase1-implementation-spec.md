# Phase 1 Implementation Specification: Amplifier Voice MVP

> **Version**: 1.0.0  
> **Date**: 2026-01-31  
> **Status**: Technical Specification  
> **Target**: Week 1-2 MVP Implementation

---

## Executive Summary

This specification provides complete implementation details for Phase 1 MVP of Amplifier Voice - a real-time voice assistant that demonstrates "voice commands that actually DO things" via Amplifier agent delegation. The MVP focuses on the core loop: user speaks → OpenAI understands → tool executes → voice responds.

### MVP Success Criteria

- [ ] WebRTC voice connection working end-to-end
- [ ] `task` tool delegates to Amplifier agents successfully
- [ ] <2s response time for simple voice queries
- [ ] Error handling doesn't break conversation flow
- [ ] 3 compelling demo scenarios working

---

## 1. File Structure and Modules

### 1.1 Server Directory Structure

```
amplifier-voice/
├── voice-server/
│   ├── voice_server/
│   │   ├── __init__.py              # Package exports
│   │   ├── config.py                # ✅ EXISTS - Configuration settings
│   │   ├── service.py               # ✅ EXISTS - FastAPI app & endpoints
│   │   ├── start.py                 # ✅ EXISTS - Server entry point
│   │   ├── realtime.py              # ✅ EXISTS - OpenAI Realtime API client
│   │   ├── amplifier_bridge.py      # ✅ EXISTS - Amplifier integration
│   │   │
│   │   ├── events/                  # 🆕 NEW - SSE event system
│   │   │   ├── __init__.py
│   │   │   ├── manager.py           # SSE connection manager
│   │   │   ├── types.py             # Event type definitions
│   │   │   └── broadcaster.py       # Event broadcasting to clients
│   │   │
│   │   ├── tools/                   # 🆕 NEW - Tool execution layer
│   │   │   ├── __init__.py
│   │   │   ├── executor.py          # Tool call handler
│   │   │   ├── formatter.py         # Result formatting for voice
│   │   │   └── registry.py          # Tool metadata & tiering
│   │   │
│   │   ├── transcript/              # ✅ EXISTS - Session transcripts
│   │   │   ├── __init__.py
│   │   │   ├── models.py            # TranscriptEntry, Session models
│   │   │   └── repository.py        # File-based transcript storage
│   │   │
│   │   └── protocols/               # ✅ EXISTS - Amplifier protocols
│   │       ├── __init__.py
│   │       ├── voice_hooks.py       # Voice-specific hooks
│   │       ├── voice_display.py     # Display messages for voice
│   │       └── voice_approval.py    # Auto-approval for voice
│   │
│   ├── pyproject.toml               # ✅ EXISTS - Dependencies
│   ├── .env.example                 # ✅ EXISTS - Environment template
│   └── README.md                    # ✅ EXISTS - Documentation
│
└── voice-client/                    # 🆕 NEW - React frontend
    ├── src/
    │   ├── main.tsx                 # React entry point
    │   ├── App.tsx                  # Main app component
    │   ├── components/
    │   │   ├── VoiceSession.tsx     # Main voice session container
    │   │   ├── AudioControls.tsx    # Mic/speaker controls
    │   │   ├── TranscriptPanel.tsx  # Live transcript display
    │   │   ├── ToolIndicator.tsx    # Tool execution feedback
    │   │   └── ConnectionStatus.tsx # WebRTC connection state
    │   ├── hooks/
    │   │   ├── useWebRTC.ts         # WebRTC connection hook
    │   │   ├── useRealtimeEvents.ts # Data channel events
    │   │   └── useSSE.ts            # Server-sent events hook
    │   ├── lib/
    │   │   ├── api.ts               # REST API client
    │   │   └── types.ts             # TypeScript types
    │   └── styles/
    │       └── main.css             # Tailwind styles
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    └── tsconfig.json
```

### 1.2 Module Responsibilities

| Module | Responsibility | Dependencies |
|--------|----------------|--------------|
| `service.py` | FastAPI endpoints, CORS, lifespan | `config`, `amplifier_bridge`, `realtime` |
| `realtime.py` | OpenAI Realtime session/SDP | `httpx` |
| `amplifier_bridge.py` | Tool execution via Amplifier | `amplifier-foundation` |
| `events/manager.py` | SSE connection tracking | `asyncio.Queue` |
| `events/broadcaster.py` | Emit events to all clients | `manager` |
| `tools/executor.py` | Handle function_call events | `amplifier_bridge`, `formatter` |
| `tools/formatter.py` | Summarize results for voice | - |
| `transcript/repository.py` | Persist transcripts to disk | `transcript/models` |

---

## 2. Key Classes and Interfaces

### 2.1 Server-Side Classes

#### AmplifierBridge (Existing - No Changes)

```python
class AmplifierBridge:
    """Programmatic Amplifier integration."""
    
    async def initialize(self) -> None
    async def execute_tool(self, tool_name: str, arguments: Dict) -> ToolResult
    def get_tools_for_openai(self) -> List[Dict]
    async def close(self) -> None
```

#### ToolResult (Existing)

```python
@dataclass
class ToolResult:
    success: bool
    output: Any
    error: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]
```

#### SSEManager (New)

```python
# voice_server/events/manager.py

from asyncio import Queue
from typing import Dict, Set
from dataclasses import dataclass, field
import uuid
import time


@dataclass
class SSEConnection:
    """Represents a single SSE connection."""
    id: str
    session_id: Optional[str]
    queue: Queue
    subscriptions: Set[str] = field(default_factory=lambda: {"*"})  # Event patterns
    created_at: float = field(default_factory=time.time)


class SSEManager:
    """Manages Server-Sent Event connections.
    
    Thread-safe connection tracking with event filtering.
    """
    
    def __init__(self):
        self._connections: Dict[str, SSEConnection] = {}
    
    async def create_connection(
        self, 
        session_id: Optional[str] = None,
        subscriptions: Optional[Set[str]] = None
    ) -> tuple[Queue, str]:
        """Create new SSE connection.
        
        Returns:
            Tuple of (event queue, connection_id)
        """
        conn_id = str(uuid.uuid4())
        queue = Queue()
        
        self._connections[conn_id] = SSEConnection(
            id=conn_id,
            session_id=session_id,
            queue=queue,
            subscriptions=subscriptions or {"*"}
        )
        
        return queue, conn_id
    
    async def remove_connection(self, conn_id: str) -> None:
        """Remove connection and cleanup."""
        if conn_id in self._connections:
            del self._connections[conn_id]
    
    async def broadcast(
        self, 
        event_type: str, 
        data: Dict,
        session_id: Optional[str] = None
    ) -> None:
        """Broadcast event to matching connections.
        
        Args:
            event_type: Event type (e.g., "tool.started")
            data: Event payload
            session_id: Optional session filter
        """
        event = {"type": event_type, "data": data, "timestamp": time.time()}
        
        for conn in self._connections.values():
            # Filter by session if specified
            if session_id and conn.session_id and conn.session_id != session_id:
                continue
            
            # Check subscription patterns
            if self._matches_subscription(event_type, conn.subscriptions):
                await conn.queue.put(event)
    
    def _matches_subscription(self, event_type: str, patterns: Set[str]) -> bool:
        """Check if event matches any subscription pattern."""
        for pattern in patterns:
            if pattern == "*":
                return True
            if pattern.endswith(".*"):
                prefix = pattern[:-2]
                if event_type.startswith(prefix):
                    return True
            if pattern == event_type:
                return True
        return False
```

#### ToolExecutor (New)

```python
# voice_server/tools/executor.py

import json
import logging
import time
from typing import Dict, Any, Optional

from ..amplifier_bridge import AmplifierBridge, ToolResult
from ..events.broadcaster import EventBroadcaster
from .formatter import format_for_voice

logger = logging.getLogger(__name__)


class ToolExecutor:
    """Handles tool execution for voice sessions.
    
    Responsibilities:
    - Execute tools via AmplifierBridge
    - Emit progress events to SSE
    - Format results for voice summarization
    - Handle errors gracefully
    """
    
    def __init__(
        self, 
        bridge: AmplifierBridge,
        broadcaster: EventBroadcaster
    ):
        self._bridge = bridge
        self._broadcaster = broadcaster
    
    async def execute(
        self,
        call_id: str,
        tool_name: str,
        arguments: Dict[str, Any],
        session_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute a tool call and return formatted result.
        
        Args:
            call_id: OpenAI function call ID
            tool_name: Name of the tool
            arguments: Tool arguments (already parsed from JSON)
            session_id: Voice session ID for event filtering
            
        Returns:
            Dict with {success, output, error?, duration_ms}
        """
        start_time = time.time()
        
        # Emit start event
        await self._broadcaster.emit(
            "tool.started",
            {
                "call_id": call_id,
                "tool_name": tool_name,
                "description": self._get_pre_announcement(tool_name),
            },
            session_id=session_id
        )
        
        try:
            # Execute via bridge
            result = await self._bridge.execute_tool(tool_name, arguments)
            duration_ms = int((time.time() - start_time) * 1000)
            
            if result.success:
                # Format output for voice
                voice_output = format_for_voice(tool_name, result.output)
                
                # Emit completion
                await self._broadcaster.emit(
                    "tool.completed",
                    {
                        "call_id": call_id,
                        "tool_name": tool_name,
                        "success": True,
                        "duration_ms": duration_ms,
                        "output_preview": voice_output[:200] if voice_output else ""
                    },
                    session_id=session_id
                )
                
                return {
                    "success": True,
                    "output": voice_output,
                    "duration_ms": duration_ms
                }
            else:
                # Handle tool failure
                error_msg = result.error or "Unknown error"
                suggestion = self._get_error_suggestion(tool_name, error_msg)
                
                await self._broadcaster.emit(
                    "tool.error",
                    {
                        "call_id": call_id,
                        "tool_name": tool_name,
                        "error": error_msg,
                        "recoverable": True,
                        "suggestion": suggestion
                    },
                    session_id=session_id
                )
                
                return {
                    "success": False,
                    "error": error_msg,
                    "suggestion": suggestion,
                    "duration_ms": duration_ms
                }
                
        except Exception as e:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = str(e)
            
            logger.error(f"Tool {tool_name} failed: {error_msg}", exc_info=True)
            
            await self._broadcaster.emit(
                "tool.error",
                {
                    "call_id": call_id,
                    "tool_name": tool_name,
                    "error": error_msg,
                    "recoverable": False
                },
                session_id=session_id
            )
            
            return {
                "success": False,
                "error": f"Tool execution failed: {error_msg}",
                "duration_ms": duration_ms
            }
    
    def _get_pre_announcement(self, tool_name: str) -> str:
        """Get voice-friendly pre-announcement for tool."""
        announcements = {
            "task": "Working on that with a specialist agent...",
            "read_file": "Reading that file...",
            "write_file": "Writing the file...",
            "glob": "Searching for files...",
            "grep": "Searching file contents...",
            "bash": "Running that command...",
            "web_search": "Searching the web...",
            "web_fetch": "Fetching that page...",
        }
        return announcements.get(tool_name, "Working on it...")
    
    def _get_error_suggestion(self, tool_name: str, error: str) -> str:
        """Generate recovery suggestion for error."""
        if "not found" in error.lower():
            return "The file or resource wasn't found. Should I search for it?"
        if "permission" in error.lower():
            return "I don't have permission for that. Is it protected?"
        if "timeout" in error.lower():
            return "That's taking too long. Should I try again?"
        return "Something went wrong. Would you like me to try a different approach?"
```

#### ResultFormatter (New)

```python
# voice_server/tools/formatter.py

from typing import Any, Dict, List
import json


def format_for_voice(tool_name: str, output: Any, max_chars: int = 2000) -> str:
    """Format tool output for voice summarization.
    
    Goals:
    - Concise enough for spoken delivery
    - Complete enough for accurate AI summary
    - Structured for LLM understanding
    
    Args:
        tool_name: Name of the tool that produced output
        output: Raw tool output (string, dict, or list)
        max_chars: Maximum output characters
        
    Returns:
        Formatted string optimized for voice AI consumption
    """
    # Handle different output types
    if output is None:
        return "Operation completed successfully (no output)."
    
    if isinstance(output, str):
        text = output
    elif isinstance(output, (dict, list)):
        text = json.dumps(output, indent=2, default=str)
    else:
        text = str(output)
    
    # Apply tool-specific formatting
    formatters = {
        "task": _format_task_output,
        "read_file": _format_file_output,
        "glob": _format_search_output,
        "grep": _format_search_output,
        "web_search": _format_search_output,
    }
    
    formatter = formatters.get(tool_name, _format_generic)
    formatted = formatter(text, output)
    
    # Truncate if too long
    if len(formatted) > max_chars:
        formatted = formatted[:max_chars - 100] + "\n\n[Output truncated. Ask for more details if needed.]"
    
    return formatted


def _format_task_output(text: str, output: Any) -> str:
    """Format task (agent delegation) output."""
    if isinstance(output, dict):
        # Extract key information from agent result
        result = output.get("result", output)
        if isinstance(result, str):
            return f"Agent completed: {result}"
        return f"Agent completed successfully. Result:\n{json.dumps(result, indent=2, default=str)}"
    return text


def _format_file_output(text: str, output: Any) -> str:
    """Format file reading output."""
    if isinstance(output, dict):
        content = output.get("content", "")
        lines = output.get("total_lines", 0)
        return f"File contents ({lines} lines):\n\n{content}"
    return text


def _format_search_output(text: str, output: Any) -> str:
    """Format search results (glob, grep, web_search)."""
    if isinstance(output, dict):
        matches = output.get("matches", output.get("results", []))
        count = output.get("count", len(matches) if isinstance(matches, list) else 0)
        
        if isinstance(matches, list) and matches:
            # Show first few results
            preview = matches[:5]
            return f"Found {count} results. Top matches:\n" + "\n".join(
                f"- {m}" if isinstance(m, str) else f"- {json.dumps(m)}"
                for m in preview
            )
        return f"Found {count} results."
    return text


def _format_generic(text: str, output: Any) -> str:
    """Generic formatting fallback."""
    return text
```

### 2.2 Client-Side Interfaces

#### WebRTC Connection Types

```typescript
// voice-client/src/lib/types.ts

export interface SessionResponse {
  client_secret: {
    value: string;
    expires_at: number;
  };
  session_id: string;
  model: string;
  voice: string;
  tools: ToolDefinition[];
}

export interface ToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface TranscriptEntry {
  id: string;
  entry_type: "user" | "assistant" | "tool_call" | "tool_result" | "system";
  timestamp: string;
  text?: string;
  tool_name?: string;
  tool_call_id?: string;
  tool_arguments?: Record<string, unknown>;
  tool_result?: unknown;
  audio_duration_ms?: number;
}

export interface RealtimeEvent {
  type: string;
  event_id?: string;
  [key: string]: unknown;
}

export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

// WebRTC connection state
export type ConnectionState = 
  | "disconnected" 
  | "connecting" 
  | "connected" 
  | "failed";

// Tool execution state
export interface ToolExecution {
  call_id: string;
  tool_name: string;
  status: "started" | "running" | "completed" | "failed";
  started_at: number;
  completed_at?: number;
  output_preview?: string;
  error?: string;
}
```

#### WebRTC Hook Interface

```typescript
// voice-client/src/hooks/useWebRTC.ts

export interface UseWebRTCOptions {
  onEvent: (event: RealtimeEvent) => void;
  onConnectionChange: (state: ConnectionState) => void;
  onTranscript: (role: "user" | "assistant", text: string) => void;
  onError: (error: Error) => void;
}

export interface UseWebRTCReturn {
  // Connection state
  connectionState: ConnectionState;
  isConnected: boolean;
  
  // Actions
  connect: (sessionResponse: SessionResponse) => Promise<void>;
  disconnect: () => void;
  
  // Data channel
  sendEvent: (event: RealtimeEvent) => void;
  
  // Audio state
  isMuted: boolean;
  setMuted: (muted: boolean) => void;
  
  // Stats
  audioLevel: number;  // 0-1 for visualizer
}
```

---

## 3. Configuration Schema

### 3.1 Server Configuration (Existing + Extensions)

```python
# voice_server/config.py - Extensions for Phase 1

from pydantic_settings import BaseSettings
from typing import List, Optional


class ServiceSettings(BaseSettings):
    """Server configuration."""
    title: str = "Amplifier Voice Assistant"
    version: str = "0.2.0"
    host: str = "0.0.0.0"
    port: int = 8080
    
    # CORS origins for client
    allowed_origins: List[str] = [
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
    ]
    
    # SSE configuration
    sse_heartbeat_seconds: int = 30
    sse_reconnect_timeout_ms: int = 3000


class RealtimeSettings(BaseSettings):
    """OpenAI Realtime API configuration."""
    openai_api_key: str = ""
    
    # Model: "gpt-realtime" (GA) or "gpt-realtime-mini" (cheaper)
    model: str = "gpt-realtime"
    
    # Voice: marin, cedar, ash, coral, sage, alloy, echo, shimmer
    voice: str = "marin"
    
    # Session limits
    max_session_duration_minutes: int = 55  # 5 min buffer before 60 min limit
    
    # Turn detection (applied client-side after WebRTC connection)
    turn_detection_type: str = "server_vad"  # or "semantic_vad"
    vad_threshold: float = 0.5
    vad_silence_duration_ms: int = 500
    vad_prefix_padding_ms: int = 300
    
    # System instructions (voice-optimized)
    instructions: str = """..."""  # Existing instructions


class AmplifierSettings(BaseSettings):
    """Amplifier integration configuration."""
    bundle: str = "amplifier-dev"
    cwd: str = "~/amplifier-working"
    auto_approve: bool = True
    tool_timeout: float = 60.0
    approval_policy: str = "auto_approve"


class ToolSettings(BaseSettings):
    """Tool execution configuration."""
    
    # Maximum output length for voice formatting
    max_output_chars: int = 2000
    
    # Tool execution timeout
    default_timeout_seconds: float = 60.0
    
    # Progress update interval for long-running tools
    progress_interval_seconds: float = 5.0


class Settings(BaseSettings):
    """Combined settings."""
    service: ServiceSettings = ServiceSettings()
    realtime: RealtimeSettings = RealtimeSettings()
    amplifier: AmplifierSettings = AmplifierSettings()
    tools: ToolSettings = ToolSettings()
```

### 3.2 Environment Variables

```bash
# .env.example - Required for Phase 1

# OpenAI (Required)
OPENAI_API_KEY=sk-...

# Anthropic (Required for task tool agent delegation)
ANTHROPIC_API_KEY=sk-ant-...

# Amplifier configuration
AMPLIFIER_BUNDLE=amplifier-dev
AMPLIFIER_CWD=~/amplifier-working
AMPLIFIER_AUTO_APPROVE=true

# Server configuration
HOST=0.0.0.0
PORT=8080
LOG_LEVEL=INFO

# Client URL (for CORS)
CLIENT_URL=http://localhost:5173
```

---

## 4. API Endpoints with Request/Response Formats

### 4.1 Session Management

#### POST /session - Create Voice Session

Creates OpenAI Realtime session with Amplifier tools configured.

```yaml
POST /session
Content-Type: application/json

Request:
  voice?: string     # "marin" (default), "ash", "coral", "sage", "cedar"

Response: 200 OK
  client_secret:
    value: string    # Ephemeral token (60 second TTL)
    expires_at: number
  session_id: string
  model: string
  voice: string
  tools: ToolDefinition[]

Errors:
  503: {"error": "Amplifier bridge not initialized"}
  500: {"error": "Failed to create OpenAI session: <details>"}
```

**Example:**

```json
// Request
{ "voice": "marin" }

// Response
{
  "client_secret": {
    "value": "ek_abc123...",
    "expires_at": 1706745600
  },
  "session_id": "vs_20260131_143022_a3f2",
  "model": "gpt-realtime",
  "voice": "marin",
  "tools": [
    {
      "type": "function",
      "name": "task",
      "description": "Delegate work to specialist AI agents...",
      "parameters": {...}
    }
  ]
}
```

#### POST /sdp - WebRTC SDP Exchange

Exchange SDP offer/answer for WebRTC connection.

```yaml
POST /sdp
Content-Type: application/sdp
Authorization: Bearer <ephemeral_key>

Request Body: SDP offer (raw text)

Response: 200 OK
Content-Type: application/sdp
Body: SDP answer (raw text)

Errors:
  400: Invalid SDP format
  401: Invalid or expired ephemeral key
  502: OpenAI connection failed
```

### 4.2 Tool Execution

#### POST /execute/{tool_name} - Execute Tool

Direct tool execution (called internally or for testing).

```yaml
POST /execute/{tool_name}
Content-Type: application/json

Request:
  arguments: object    # Tool-specific arguments
  call_id?: string     # OpenAI function call ID
  timeout_ms?: number  # Execution timeout (default: 60000)

Response: 200 OK
  success: boolean
  output: string       # Formatted for voice
  error?: string
  duration_ms: number

Errors:
  400: Invalid arguments
  404: Tool not found
  408: Execution timeout
  503: Amplifier bridge not initialized
```

#### GET /tools - List Available Tools

```yaml
GET /tools

Response: 200 OK
  tools: ToolDefinition[]
  count: number
```

### 4.3 Event Streaming

#### GET /events - Server-Sent Events

```yaml
GET /events
Accept: text/event-stream
X-Session-ID: <voice_session_id>  # Optional

Query Parameters:
  subscribe?: string   # Comma-separated patterns: "tool.*,session.*"

Response: 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

# Event format:
event: <event_type>
data: <json_payload>
id: <event_id>
```

**Event Types:**

```yaml
# Session events
event: session.started
data: {"session_id": "...", "voice": "...", "tools_count": 5}

event: session.ended
data: {"session_id": "...", "reason": "completed", "duration_ms": 120000}

# Tool events
event: tool.started
data: {"call_id": "...", "tool_name": "task", "description": "Working on it..."}

event: tool.progress
data: {"call_id": "...", "tool_name": "task", "message": "Agent executing...", "percentage": 50}

event: tool.completed
data: {"call_id": "...", "tool_name": "task", "success": true, "duration_ms": 2500}

event: tool.error
data: {"call_id": "...", "tool_name": "task", "error": "...", "recoverable": true}

# Connection events
event: connection.status
data: {"webrtc_state": "connected", "data_channel_state": "open"}

# Heartbeat (every 30 seconds)
event: heartbeat
data: {"timestamp": "...", "session_active": true}
```

### 4.4 Transcript Management

#### GET /sessions - List Sessions

```yaml
GET /sessions?status=active&limit=20

Response: 200 OK
  sessions: SessionInfo[]
  count: number
```

#### GET /sessions/{session_id} - Get Session Details

```yaml
GET /sessions/{session_id}

Response: 200 OK
  session: SessionInfo
  transcript: TranscriptEntry[]

Errors:
  404: Session not found
```

#### POST /sessions/{session_id}/transcript - Sync Transcript

```yaml
POST /sessions/{session_id}/transcript
Content-Type: application/json

Request:
  entries: TranscriptEntry[]

Response: 200 OK
  synced: number
  session_id: string
```

### 4.5 Health Check

#### GET /health

```yaml
GET /health

Response: 200 OK
  status: "healthy" | "degraded" | "unhealthy"
  version: string
  amplifier:
    enabled: boolean
    tools_count: number
  model: string
  uptime_seconds: number
```

---

## 5. WebRTC Setup Sequence

### 5.1 Connection Flow Diagram

```
Browser                    Voice Server              OpenAI Realtime
   │                            │                         │
   │ 1. POST /session           │                         │
   │ {"voice": "marin"}         │                         │
   │─────────────────────────►  │                         │
   │                            │                         │
   │                            │ 2. Get tools from       │
   │                            │    AmplifierBridge      │
   │                            │                         │
   │                            │ 3. POST /realtime/client_secrets
   │                            │    {model, voice, tools}│
   │                            │─────────────────────────►
   │                            │◄────────────────────────
   │                            │    {client_secret}      │
   │◄───────────────────────────│                         │
   │ {client_secret, session_id,│                         │
   │  voice, tools}             │                         │
   │                            │                         │
   │ 4. Create RTCPeerConnection│                         │
   │    Add microphone track    │                         │
   │    Create data channel     │                         │
   │    "oai-events"            │                         │
   │                            │                         │
   │ 5. Create SDP offer        │                         │
   │                            │                         │
   │ 6. POST /sdp               │                         │
   │    Authorization: ek_...   │                         │
   │    Body: SDP offer         │                         │
   │─────────────────────────►  │                         │
   │                            │ 7. POST /realtime/calls │
   │                            │    Body: SDP offer      │
   │                            │─────────────────────────►
   │                            │◄────────────────────────
   │                            │    SDP answer           │
   │◄───────────────────────────│                         │
   │    SDP answer              │                         │
   │                            │                         │
   │ 8. setRemoteDescription    │                         │
   │                            │                         │
   │◄════════════WebRTC Audio════════════════════════════►
   │                            │                         │
   │ 9. Data channel open       │                         │
   │    Configure session:      │                         │
   │    - turn_detection        │                         │
   │    - input_transcription   │                         │
   │════════════════════════════════════════════════════►
   │                            │                         │
   │ 10. GET /events            │                         │
   │     X-Session-ID: vs_...   │                         │
   │─────────────────────────►  │                         │
   │◄─ ─ ─ ─ ─ SSE ─ ─ ─ ─ ─ ─  │                         │
   │                            │                         │
```

### 5.2 Client Implementation

```typescript
// voice-client/src/hooks/useWebRTC.ts

import { useCallback, useRef, useState } from "react";
import type { 
  SessionResponse, 
  RealtimeEvent, 
  ConnectionState 
} from "../lib/types";

export function useWebRTC(options: UseWebRTCOptions): UseWebRTCReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>("disconnected");
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioTrackRef = useRef<MediaStreamTrack | null>(null);
  
  const connect = useCallback(async (session: SessionResponse) => {
    try {
      setConnectionState("connecting");
      
      // 1. Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      const [track] = stream.getAudioTracks();
      audioTrackRef.current = track;
      
      // 2. Create peer connection (no ICE servers needed)
      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      
      // 3. Handle remote audio
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      pc.ontrack = (e) => {
        audioEl.srcObject = e.streams[0];
      };
      
      // 4. Add local audio track
      pc.addTrack(track, stream);
      
      // 5. Create data channel for events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      
      dc.onopen = () => {
        // Configure session after connection
        sendSessionUpdate();
      };
      
      dc.onmessage = (e) => {
        const event = JSON.parse(e.data) as RealtimeEvent;
        handleRealtimeEvent(event);
      };
      
      // 6. Monitor connection state
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "connected") {
          setConnectionState("connected");
          options.onConnectionChange("connected");
        } else if (state === "failed" || state === "closed") {
          setConnectionState("failed");
          options.onConnectionChange("failed");
        }
      };
      
      // 7. Create and set local description
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // 8. Exchange SDP via server
      const response = await fetch("/sdp", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.client_secret.value}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });
      
      if (!response.ok) {
        throw new Error(`SDP exchange failed: ${response.status}`);
      }
      
      const answerSdp = await response.text();
      
      // 9. Set remote description
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
      
    } catch (error) {
      setConnectionState("failed");
      options.onError(error as Error);
    }
  }, [options]);
  
  const sendSessionUpdate = useCallback(() => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify({
        type: "session.update",
        session: {
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
          },
          input_audio_transcription: {
            model: "whisper-1",
          },
        },
      }));
    }
  }, []);
  
  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    // Handle transcription events
    if (event.type === "conversation.item.input_audio_transcription.completed") {
      options.onTranscript("user", event.transcript as string);
    }
    if (event.type === "response.audio_transcript.done") {
      options.onTranscript("assistant", event.transcript as string);
    }
    
    // Forward all events
    options.onEvent(event);
  }, [options]);
  
  const disconnect = useCallback(() => {
    if (audioTrackRef.current) {
      audioTrackRef.current.stop();
    }
    if (pcRef.current) {
      pcRef.current.close();
    }
    setConnectionState("disconnected");
  }, []);
  
  const sendEvent = useCallback((event: RealtimeEvent) => {
    if (dcRef.current?.readyState === "open") {
      dcRef.current.send(JSON.stringify(event));
    }
  }, []);
  
  return {
    connectionState,
    isConnected: connectionState === "connected",
    connect,
    disconnect,
    sendEvent,
    isMuted,
    setMuted: (muted) => {
      if (audioTrackRef.current) {
        audioTrackRef.current.enabled = !muted;
      }
      setIsMuted(muted);
    },
    audioLevel,
  };
}
```

---

## 6. Tool Integration Approach

### 6.1 Tool Call Flow (Client Perspective)

```
User: "Find all Python files in src"
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1. SPEECH PROCESSING (OpenAI Realtime)                         │
│    - VAD detects end of speech                                  │
│    - Audio transcribed: "Find all Python files in src"         │
│    - LLM decides to call tool                                   │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼ Data Channel: response.function_call_arguments.done
         │ {call_id: "call_123", name: "task", arguments: "..."}
         │
┌─────────────────────────────────────────────────────────────────┐
│ 2. CLIENT RECEIVES FUNCTION CALL                                │
│    - Parse arguments                                            │
│    - Show "Working on it..." indicator                          │
│    - Forward to server                                          │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼ POST /execute/task
         │
┌─────────────────────────────────────────────────────────────────┐
│ 3. SERVER EXECUTES TOOL                                         │
│    - ToolExecutor.execute()                                     │
│    - AmplifierBridge.execute_tool()                             │
│    - Emit SSE: tool.started                                     │
│    - Agent delegation (task → explorer)                         │
│    - Emit SSE: tool.progress (if long-running)                  │
│    - Format result for voice                                    │
│    - Emit SSE: tool.completed                                   │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼ Response: {success: true, output: "Found 15 Python files..."}
         │
┌─────────────────────────────────────────────────────────────────┐
│ 4. CLIENT SENDS RESULT TO OPENAI                                │
│    - conversation.item.create (function_call_output)            │
│    - response.create (trigger voice response)                   │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼ Data Channel: response.audio.delta (streaming audio)
         │
┌─────────────────────────────────────────────────────────────────┐
│ 5. VOICE RESPONSE                                               │
│    - OpenAI generates spoken summary                            │
│    - Audio streams to browser                                   │
│    - "I found 15 Python files in the src directory..."          │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Function Call Handler (Client)

```typescript
// voice-client/src/lib/toolHandler.ts

import type { RealtimeEvent } from "./types";

interface FunctionCallArgs {
  call_id: string;
  name: string;
  arguments: string;  // JSON string from OpenAI
}

export async function handleFunctionCall(
  args: FunctionCallArgs,
  sendEvent: (event: RealtimeEvent) => void,
  onToolStart: (name: string) => void,
  onToolEnd: (name: string, success: boolean) => void
): Promise<void> {
  const { call_id, name, arguments: argsJson } = args;
  
  // Parse arguments
  let parsedArgs: Record<string, unknown>;
  try {
    parsedArgs = JSON.parse(argsJson);
  } catch {
    parsedArgs = {};
  }
  
  // Notify UI
  onToolStart(name);
  
  try {
    // Execute tool via server
    const response = await fetch(`/execute/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        arguments: parsedArgs,
        call_id,
      }),
    });
    
    const result = await response.json();
    
    // Format output for OpenAI
    const output = result.success 
      ? result.output 
      : JSON.stringify({ error: result.error, suggestion: result.suggestion });
    
    // Send result back to OpenAI (REQUIRED - both events!)
    sendEvent({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id,
        output,
      },
    });
    
    // Trigger voice response (REQUIRED!)
    sendEvent({
      type: "response.create",
    });
    
    onToolEnd(name, result.success);
    
  } catch (error) {
    // Send error back to OpenAI
    sendEvent({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id,
        output: JSON.stringify({ 
          error: String(error),
          suggestion: "Something went wrong. Would you like me to try again?"
        }),
      },
    });
    
    sendEvent({
      type: "response.create",
    });
    
    onToolEnd(name, false);
  }
}
```

### 6.3 Event Handling Flow

```typescript
// voice-client/src/hooks/useRealtimeEvents.ts

import { useCallback, useRef } from "react";
import type { RealtimeEvent } from "../lib/types";
import { handleFunctionCall } from "../lib/toolHandler";

interface EventHandlerOptions {
  sendEvent: (event: RealtimeEvent) => void;
  onTranscript: (role: "user" | "assistant", text: string) => void;
  onToolStart: (name: string) => void;
  onToolEnd: (name: string, success: boolean) => void;
  onSpeechStarted: () => void;
  onSpeechStopped: () => void;
}

export function useRealtimeEvents(options: EventHandlerOptions) {
  const pendingCallsRef = useRef<Set<string>>(new Set());
  
  const handleEvent = useCallback((event: RealtimeEvent) => {
    switch (event.type) {
      // User speech events
      case "input_audio_buffer.speech_started":
        options.onSpeechStarted();
        break;
        
      case "input_audio_buffer.speech_stopped":
        options.onSpeechStopped();
        break;
      
      // Transcription events
      case "conversation.item.input_audio_transcription.completed":
        options.onTranscript("user", event.transcript as string);
        break;
        
      case "response.audio_transcript.done":
        options.onTranscript("assistant", event.transcript as string);
        break;
      
      // Function call events
      case "response.function_call_arguments.done":
        const callId = event.call_id as string;
        
        // Prevent duplicate handling
        if (pendingCallsRef.current.has(callId)) {
          return;
        }
        pendingCallsRef.current.add(callId);
        
        handleFunctionCall(
          {
            call_id: callId,
            name: event.name as string,
            arguments: event.arguments as string,
          },
          options.sendEvent,
          options.onToolStart,
          (name, success) => {
            pendingCallsRef.current.delete(callId);
            options.onToolEnd(name, success);
          }
        );
        break;
        
      // Response completion
      case "response.done":
        // Track usage, log completion
        break;
        
      // Error handling
      case "error":
        console.error("Realtime API error:", event);
        break;
    }
  }, [options]);
  
  return { handleEvent };
}
```

---

## 7. Error Handling Patterns

### 7.1 Error Categories and Responses

| Category | Examples | Recovery Strategy |
|----------|----------|-------------------|
| **Connection** | WebRTC failed, timeout | Auto-reconnect with backoff |
| **Session** | Token expired, limit reached | Create new session, restore context |
| **Tool** | Execution failed, timeout | Return friendly error, suggest alternative |
| **API** | Rate limit, server error | Exponential backoff, user notification |

### 7.2 Server Error Handling

```python
# voice_server/errors.py

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import logging
import time
import uuid

logger = logging.getLogger(__name__)


class VoiceServerError(Exception):
    """Base error for voice server."""
    
    def __init__(
        self, 
        code: str, 
        message: str, 
        status_code: int = 500,
        details: Optional[dict] = None,
        recoverable: bool = True
    ):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        self.recoverable = recoverable
        self.request_id = str(uuid.uuid4())[:8]
        super().__init__(message)
    
    def to_response(self) -> JSONResponse:
        return JSONResponse(
            status_code=self.status_code,
            content={
                "error": {
                    "code": self.code,
                    "message": self.message,
                    "details": self.details,
                    "recoverable": self.recoverable,
                    "request_id": self.request_id,
                    "timestamp": time.time(),
                }
            }
        )


class AmplifierUnavailable(VoiceServerError):
    def __init__(self):
        super().__init__(
            code="amplifier_unavailable",
            message="Amplifier bridge not initialized. Please try again.",
            status_code=503,
            recoverable=True
        )


class ToolNotFound(VoiceServerError):
    def __init__(self, tool_name: str):
        super().__init__(
            code="tool_not_found",
            message=f"Tool '{tool_name}' not found",
            status_code=404,
            details={"tool_name": tool_name},
            recoverable=False
        )


class ToolTimeout(VoiceServerError):
    def __init__(self, tool_name: str, timeout_seconds: float):
        super().__init__(
            code="tool_timeout",
            message=f"Tool '{tool_name}' timed out after {timeout_seconds}s",
            status_code=408,
            details={"tool_name": tool_name, "timeout_seconds": timeout_seconds},
            recoverable=True
        )


class OpenAIError(VoiceServerError):
    def __init__(self, original_error: str):
        super().__init__(
            code="openai_error",
            message=f"OpenAI API error: {original_error}",
            status_code=502,
            recoverable=True
        )


# Global error handler
def register_error_handlers(app):
    @app.exception_handler(VoiceServerError)
    async def voice_error_handler(request, exc: VoiceServerError):
        logger.error(f"[{exc.request_id}] {exc.code}: {exc.message}")
        return exc.to_response()
    
    @app.exception_handler(Exception)
    async def general_error_handler(request, exc: Exception):
        request_id = str(uuid.uuid4())[:8]
        logger.error(f"[{request_id}] Unexpected error: {exc}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "An unexpected error occurred",
                    "request_id": request_id,
                    "timestamp": time.time(),
                }
            }
        )
```

### 7.3 Client Error Handling

```typescript
// voice-client/src/lib/errors.ts

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
  request_id: string;
}

export class VoiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public recoverable: boolean = true,
    public suggestion?: string
  ) {
    super(message);
    this.name = "VoiceError";
  }
}

// Error translations for voice
const ERROR_MESSAGES: Record<string, { message: string; suggestion: string }> = {
  amplifier_unavailable: {
    message: "I'm having trouble connecting to my tools.",
    suggestion: "Let me try reconnecting.",
  },
  tool_not_found: {
    message: "I don't have that capability.",
    suggestion: "Could you try asking in a different way?",
  },
  tool_timeout: {
    message: "That's taking longer than expected.",
    suggestion: "Should I keep trying or try something else?",
  },
  openai_error: {
    message: "I'm having trouble processing that.",
    suggestion: "Could you repeat that?",
  },
  network_error: {
    message: "I've lost connection.",
    suggestion: "Let me try to reconnect.",
  },
};

export function translateError(error: APIError | Error): {
  voiceMessage: string;
  suggestion: string;
  recoverable: boolean;
} {
  if ("code" in error) {
    const translation = ERROR_MESSAGES[error.code];
    if (translation) {
      return {
        voiceMessage: translation.message,
        suggestion: translation.suggestion,
        recoverable: error.recoverable,
      };
    }
  }
  
  return {
    voiceMessage: "Something went wrong.",
    suggestion: "Could you try again?",
    recoverable: true,
  };
}

// Retry logic
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if retryable
      if (error instanceof VoiceError && !error.recoverable) {
        throw error;
      }
      
      // Exponential backoff
      const delay = baseDelayMs * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
```

### 7.4 Graceful Degradation

```typescript
// voice-client/src/hooks/useConnectionRecovery.ts

import { useCallback, useEffect, useRef } from "react";
import type { ConnectionState, SessionResponse } from "../lib/types";

interface RecoveryOptions {
  connectionState: ConnectionState;
  connect: (session: SessionResponse) => Promise<void>;
  createSession: () => Promise<SessionResponse>;
  maxRetries?: number;
  retryDelayMs?: number;
}

export function useConnectionRecovery(options: RecoveryOptions) {
  const {
    connectionState,
    connect,
    createSession,
    maxRetries = 3,
    retryDelayMs = 2000,
  } = options;
  
  const retryCountRef = useRef(0);
  const lastSessionRef = useRef<SessionResponse | null>(null);
  
  const attemptReconnection = useCallback(async () => {
    if (retryCountRef.current >= maxRetries) {
      console.error("Max reconnection attempts reached");
      return;
    }
    
    retryCountRef.current++;
    const delay = retryDelayMs * Math.pow(1.5, retryCountRef.current - 1);
    
    console.log(`Reconnection attempt ${retryCountRef.current} in ${delay}ms`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      // Create new session
      const session = await createSession();
      lastSessionRef.current = session;
      
      // Reconnect
      await connect(session);
      
      // Reset on success
      retryCountRef.current = 0;
      
    } catch (error) {
      console.error("Reconnection failed:", error);
      // Will retry on next effect trigger
    }
  }, [connect, createSession, maxRetries, retryDelayMs]);
  
  // Auto-reconnect on disconnection
  useEffect(() => {
    if (connectionState === "failed") {
      attemptReconnection();
    }
  }, [connectionState, attemptReconnection]);
  
  // Reset retry count on successful connection
  useEffect(() => {
    if (connectionState === "connected") {
      retryCountRef.current = 0;
    }
  }, [connectionState]);
  
  return {
    retryCount: retryCountRef.current,
    attemptReconnection,
  };
}
```

---

## 8. Implementation Checklist

### Week 1: Core Infrastructure

- [ ] **Day 1-2: Server Events System**
  - [ ] Create `events/manager.py` (SSEManager class)
  - [ ] Create `events/broadcaster.py` (EventBroadcaster)
  - [ ] Add `/events` SSE endpoint to service.py
  - [ ] Add heartbeat mechanism

- [ ] **Day 3-4: Tool Execution Layer**
  - [ ] Create `tools/executor.py` (ToolExecutor class)
  - [ ] Create `tools/formatter.py` (result formatting)
  - [ ] Integrate with existing AmplifierBridge
  - [ ] Add progress events for long-running tools

- [ ] **Day 5: Client Foundation**
  - [ ] Set up Vite + React project
  - [ ] Implement `useWebRTC` hook
  - [ ] Implement `useSSE` hook
  - [ ] Create basic VoiceSession component

### Week 2: Integration & Polish

- [ ] **Day 1-2: Function Call Flow**
  - [ ] Implement client-side function call handler
  - [ ] Wire up tool execution → OpenAI response flow
  - [ ] Test with `task` tool delegation

- [ ] **Day 3-4: UI Components**
  - [ ] TranscriptPanel with live updates
  - [ ] ToolIndicator for execution feedback
  - [ ] ConnectionStatus indicator
  - [ ] AudioControls (mute, volume)

- [ ] **Day 5: Error Handling & Testing**
  - [ ] Implement error translation
  - [ ] Add reconnection logic
  - [ ] Test edge cases
  - [ ] Create demo scenarios

---

## 9. Demo Scenarios

### 9.1 Scenario: Code Exploration

```
User: "What files are in the source directory?"

[Tool: task → foundation:explorer]
[Duration: ~2s]
Assistant: "I found 15 Python files in the src directory. The main ones are
main.py, config.py, and several modules in the utils folder. Would you like
me to look at any of them?"
```

### 9.2 Scenario: Web Research

```
User: "What's the latest news about TypeScript 5.4?"

[Tool: task → foundation:web-research]
[Duration: ~5s]
Assistant: "TypeScript 5.4 was released in March 2024. The big features are
improved type narrowing, the NoInfer utility type, and better support for
Object.groupBy. Would you like more details on any of these?"
```

### 9.3 Scenario: Code Modification

```
User: "Add a health check endpoint to the server"

[Tool: task → foundation:modular-builder]
[Duration: ~10s]
Assistant: "I've added a health check endpoint at /health. It returns the server
status, version, and uptime. The endpoint is now available - would you like me
to test it?"
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

```python
# tests/test_tools_formatter.py

import pytest
from voice_server.tools.formatter import format_for_voice

def test_format_task_output_success():
    output = {"result": "Created 3 files successfully"}
    result = format_for_voice("task", output)
    assert "Agent completed" in result

def test_format_search_output():
    output = {"count": 5, "matches": ["a.py", "b.py", "c.py"]}
    result = format_for_voice("glob", output)
    assert "Found 5 results" in result

def test_truncation():
    long_output = "x" * 5000
    result = format_for_voice("generic", long_output, max_chars=100)
    assert len(result) <= 100
    assert "truncated" in result.lower()
```

### 10.2 Integration Tests

```python
# tests/test_session_flow.py

import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_session_creation(test_client: AsyncClient):
    response = await test_client.post("/session", json={"voice": "marin"})
    assert response.status_code == 200
    data = response.json()
    assert "client_secret" in data
    assert "session_id" in data
    assert data["voice"] == "marin"

@pytest.mark.asyncio
async def test_tool_execution(test_client: AsyncClient, mock_amplifier):
    response = await test_client.post(
        "/execute/task",
        json={"arguments": {"instruction": "test"}, "call_id": "test_123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "success" in data
    assert "duration_ms" in data
```

### 10.3 End-to-End Tests

```typescript
// voice-client/tests/e2e/voice-session.spec.ts

import { test, expect } from '@playwright/test';

test('complete voice session flow', async ({ page }) => {
  await page.goto('/');
  
  // Start session
  await page.click('[data-testid="start-session"]');
  await expect(page.locator('[data-testid="connection-status"]'))
    .toHaveText('Connected');
  
  // Wait for greeting (mocked audio)
  await expect(page.locator('[data-testid="transcript"]'))
    .toContainText('Hello', { timeout: 5000 });
});
```

---

## 11. Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Session start time | <2s | Time from button click to first audio |
| Voice response latency | <500ms | Time from speech end to audio start |
| Tool execution (simple) | <3s | glob, read_file |
| Tool execution (complex) | <30s | task with agent delegation |
| WebRTC connection | <1s | ICE connection establishment |
| SSE delivery | <100ms | Event broadcast to client |

---

## 12. Security Considerations

### 12.1 Phase 1 Security Scope

- **Ephemeral tokens**: 60-second TTL, single-use
- **CORS**: Strict origin validation
- **Tool sandboxing**: Via Amplifier's approval policies
- **No authentication**: MVP runs in trusted environment

### 12.2 Deferred to Phase 2+

- User authentication
- Rate limiting
- Audit logging
- Multi-tenant isolation
- API key rotation

---

## 13. Dependencies

### 13.1 Server (Python 3.11+)

```toml
[project]
dependencies = [
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",
    "httpx>=0.26.0",
    "pydantic>=2.5.0",
    "pydantic-settings>=2.1.0",
    "amplifier-foundation>=0.5.0",
]
```

### 13.2 Client (Node 20+)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "@types/react": "^18.2.0",
    "tailwindcss": "^3.4.0"
  }
}
```

---

## 14. Conclusion

This specification provides a complete implementation guide for Phase 1 MVP of Amplifier Voice. Key design decisions:

1. **Client-side tool execution**: Browser handles function calls, maintains control
2. **SSE for progress**: Real-time feedback without polling
3. **Voice-optimized formatting**: Results summarized for spoken delivery
4. **Graceful degradation**: Auto-reconnect, friendly error messages
5. **Minimal new code**: Leverage existing AmplifierBridge, transcript storage

The MVP demonstrates the core value proposition: **voice commands that actually DO things** through Amplifier agent delegation.

---

## Appendix A: Quick Reference

### API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/session` | POST | Create voice session |
| `/sdp` | POST | WebRTC SDP exchange |
| `/execute/{tool}` | POST | Execute tool |
| `/tools` | GET | List available tools |
| `/events` | GET | SSE stream |
| `/sessions` | GET | List sessions |
| `/health` | GET | Health check |

### Event Types Summary

| Event | Direction | Purpose |
|-------|-----------|---------|
| `session.update` | Client→OpenAI | Configure session |
| `response.function_call_arguments.done` | OpenAI→Client | Tool call request |
| `conversation.item.create` | Client→OpenAI | Send tool result |
| `response.create` | Client→OpenAI | Trigger response |
| `tool.started` | Server→Client | Tool execution began |
| `tool.completed` | Server→Client | Tool execution done |

---

*Specification complete. Ready for implementation.*

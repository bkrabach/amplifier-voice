# API Design Specification: Amplifier Voice Server

> **Version**: 1.0.0  
> **Date**: 2026-01-31  
> **Status**: Design Specification  
> **Base URL**: `http://localhost:8080` (development)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Session Management APIs](#2-session-management-apis)
3. [WebRTC Connection Flow](#3-webrtc-connection-flow)
4. [Tool Registration & Configuration](#4-tool-registration--configuration)
5. [Event Streaming (SSE)](#5-event-streaming-sse)
6. [Health & Status APIs](#6-health--status-apis)
7. [Configuration APIs](#7-configuration-apis)
8. [Error Handling](#8-error-handling)
9. [OpenAPI Specification](#9-openapi-specification)
10. [Sequence Diagrams](#10-sequence-diagrams)

---

## 1. Overview

### Architecture Summary

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          VOICE SERVER API ARCHITECTURE                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Browser Client                                                             │
│        │                                                                     │
│        ├──── REST API ────────► Voice Server (FastAPI)                       │
│        │     /session              │                                         │
│        │     /sdp                  ├──► Amplifier Bridge ──► Tool Execution  │
│        │     /tools                │                                         │
│        │     /health               ├──► OpenAI Realtime API                  │
│        │                           │                                         │
│        ├──── SSE ◄────────────────┘    (Event Streaming)                    │
│        │     /events                                                         │
│        │                                                                     │
│        └──── WebRTC ◄─────────────────► OpenAI (Audio Streaming)            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### API Categories

| Category | Purpose | Endpoints |
|----------|---------|-----------|
| **Session** | Voice session lifecycle | `/session`, `/sessions/*` |
| **WebRTC** | Real-time audio connection | `/sdp` |
| **Tools** | Amplifier tool management | `/tools`, `/execute/*` |
| **Events** | Server-sent events | `/events` |
| **Health** | Server status | `/health`, `/status` |
| **Config** | Runtime configuration | `/config/*` |

### Authentication

| Method | Use Case | Header |
|--------|----------|--------|
| None | Development endpoints | - |
| Bearer Token | Protected endpoints | `Authorization: Bearer <token>` |
| Ephemeral Key | WebRTC SDP exchange | `Authorization: Bearer <ephemeral_key>` |

---

## 2. Session Management APIs

### 2.1 Create Voice Session

Creates a new OpenAI Realtime session with Amplifier tools configured.

```yaml
POST /session
Content-Type: application/json

Request:
  voice?: string          # Voice: "marin", "ash", "coral", "sage", "cedar"
  instructions?: string   # Custom system instructions (optional)
  tools_filter?: string[] # Limit tools to specific names (optional)

Response: 200 OK
  client_secret:
    value: string         # Ephemeral token for WebRTC auth
    expires_at: number    # Unix timestamp (60 seconds from now)
  session_id: string      # Voice server session identifier
  model: string           # "gpt-realtime"
  voice: string           # Configured voice
  tools: ToolDefinition[] # Tools registered with OpenAI

Errors:
  503: Amplifier bridge not initialized
  500: OpenAI API error
```

**Example Request:**
```json
{
  "voice": "marin"
}
```

**Example Response:**
```json
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
      "description": "Delegate work to specialist agents",
      "parameters": { ... }
    }
  ]
}
```

### 2.2 List Sessions

Returns all tracked voice sessions for session picker UI.

```yaml
GET /sessions
Query Parameters:
  status?: string   # Filter: "active", "completed", "error"
  limit?: integer   # Max results (default: 20)

Response: 200 OK
  sessions: SessionInfo[]
  count: integer

SessionInfo:
  id: string
  status: string           # "active", "completed", "error"
  created_at: string       # ISO 8601 timestamp
  updated_at: string
  duration_ms: integer
  turn_count: integer
  title?: string           # Generated title from conversation
```

**Example Response:**
```json
{
  "sessions": [
    {
      "id": "vs_20260131_143022_a3f2",
      "status": "completed",
      "created_at": "2026-01-31T14:30:22Z",
      "updated_at": "2026-01-31T14:45:10Z",
      "duration_ms": 888000,
      "turn_count": 12,
      "title": "Code review discussion"
    }
  ],
  "count": 1
}
```

### 2.3 Create Tracked Session

Creates a session record for transcript tracking (before WebRTC connection).

```yaml
POST /sessions
Content-Type: application/json

Request:
  title?: string      # Optional session title
  metadata?: object   # Custom metadata

Response: 201 Created
  session_id: string
  session: SessionInfo
```

### 2.4 Get Session Details

Returns session details including full transcript.

```yaml
GET /sessions/{session_id}

Response: 200 OK
  session: SessionInfo
  transcript: TranscriptEntry[]

TranscriptEntry:
  id: string
  entry_type: string      # "user", "assistant", "tool_call", "tool_result", "system"
  timestamp: string       # ISO 8601
  text?: string           # Transcript text
  tool_name?: string      # For tool entries
  tool_call_id?: string
  tool_arguments?: object
  tool_result?: object
  audio_duration_ms?: integer

Errors:
  404: Session not found
```

### 2.5 Sync Transcript

Syncs transcript entries from client (called during/after conversation).

```yaml
POST /sessions/{session_id}/transcript
Content-Type: application/json

Request:
  entries: TranscriptEntry[]

Response: 200 OK
  synced: integer       # Number of entries synced
  session_id: string
```

**Example Request:**
```json
{
  "entries": [
    {
      "entry_type": "user",
      "text": "Can you read the main.py file?",
      "audio_duration_ms": 2500
    },
    {
      "entry_type": "tool_call",
      "tool_name": "task",
      "tool_call_id": "call_abc123",
      "tool_arguments": {
        "agent": "foundation:explorer",
        "task": "Read main.py file"
      }
    }
  ]
}
```

### 2.6 Resume Session

Gets context for resuming an existing session with conversation history.

```yaml
POST /sessions/{session_id}/resume
Content-Type: application/json

Request:
  voice?: string        # Voice for resumed session

Response: 200 OK
  session_id: string
  session: SessionInfo
  context_to_inject: ConversationItem[]  # For OpenAI context injection
  transcript: TranscriptEntry[]          # Full transcript for UI
  realtime: SessionResponse              # New OpenAI session credentials

ConversationItem:
  type: string          # "message"
  role: string          # "user", "assistant", "system"
  content: ContentPart[]

ContentPart:
  type: string          # "input_text", "text"
  text: string

Errors:
  404: Session not found
  503: Amplifier bridge not initialized
```

**Example Response:**
```json
{
  "session_id": "vs_20260131_143022_a3f2",
  "session": { ... },
  "context_to_inject": [
    {
      "type": "message",
      "role": "system",
      "content": [{ "type": "input_text", "text": "Previous conversation summary: User asked about code review..." }]
    }
  ],
  "transcript": [ ... ],
  "realtime": {
    "client_secret": { "value": "ek_xyz789...", "expires_at": 1706745700 },
    "session_id": "vs_20260131_145022_b4c3",
    "model": "gpt-realtime",
    "voice": "marin",
    "tools": [ ... ]
  }
}
```

### 2.7 End Session

Explicitly ends a session and finalizes transcript.

```yaml
POST /sessions/{session_id}/end
Content-Type: application/json

Request:
  summary?: string       # Optional final summary
  status?: string        # "completed" (default), "cancelled", "error"

Response: 200 OK
  session: SessionInfo
  duration_ms: integer
  turn_count: integer
```

---

## 3. WebRTC Connection Flow

### 3.1 SDP Exchange

Exchanges SDP offer/answer for WebRTC connection to OpenAI Realtime.

```yaml
POST /sdp
Content-Type: application/sdp
Authorization: Bearer <ephemeral_key>

Request Body: SDP offer (text)

Response: 200 OK
Content-Type: application/sdp
Body: SDP answer (text)

Errors:
  400: Invalid SDP format
  401: Invalid or expired ephemeral key
  502: OpenAI connection failed
```

**Flow Diagram:**
```
Browser                    Voice Server              OpenAI Realtime
   │                            │                         │
   │ POST /session              │                         │
   │──────────────────────────>│                         │
   │                            │ POST /realtime/sessions │
   │                            │────────────────────────>│
   │                            │<────────────────────────│
   │<──────────────────────────│  {client_secret}        │
   │  {client_secret, tools}   │                         │
   │                            │                         │
   │ createOffer()             │                         │
   │ POST /sdp (SDP offer)     │                         │
   │──────────────────────────>│                         │
   │                            │ POST /realtime/calls    │
   │                            │────────────────────────>│
   │                            │<────────────────────────│
   │<──────────────────────────│  SDP answer             │
   │  SDP answer               │                         │
   │                            │                         │
   │<==========WebRTC Audio=============>                │
   │                            │                         │
```

### 3.2 ICE Configuration

The voice server provides ICE configuration for WebRTC setup:

```yaml
GET /ice-config

Response: 200 OK
  ice_servers: IceServer[]
  ice_transport_policy: string  # "all" or "relay"

IceServer:
  urls: string[]
  username?: string
  credential?: string
```

**Note:** OpenAI Realtime API provides ICE candidates directly in SDP answer. TURN servers are not supported - only direct UDP connections work.

---

## 4. Tool Registration & Configuration

### 4.1 List Available Tools

Returns all Amplifier tools in OpenAI function calling format.

```yaml
GET /tools

Response: 200 OK
  tools: ToolDefinition[]
  count: integer
  categories: ToolCategory[]

ToolDefinition:
  type: string            # "function"
  name: string            # Tool name (e.g., "task", "bash")
  description: string     # Human-readable description
  parameters: JSONSchema  # Parameter schema

ToolCategory:
  name: string            # Category name
  tools: string[]         # Tool names in category
```

**Example Response:**
```json
{
  "tools": [
    {
      "type": "function",
      "name": "task",
      "description": "Delegate work to specialist AI agents. Available agents include foundation:explorer, foundation:modular-builder, foundation:bug-hunter, and more.",
      "parameters": {
        "type": "object",
        "properties": {
          "agent": {
            "type": "string",
            "description": "Agent to delegate to (e.g., 'foundation:explorer')"
          },
          "task": {
            "type": "string",
            "description": "Task description for the agent"
          }
        },
        "required": ["task"]
      }
    }
  ],
  "count": 1,
  "categories": [
    { "name": "delegation", "tools": ["task"] }
  ]
}
```

### 4.2 Get Tool Details

Returns detailed information about a specific tool.

```yaml
GET /tools/{tool_name}

Response: 200 OK
  tool: ToolDefinition
  execution_stats: ExecutionStats
  examples: ToolExample[]

ExecutionStats:
  total_calls: integer
  avg_duration_ms: number
  success_rate: number
  last_called?: string      # ISO 8601 timestamp

ToolExample:
  description: string
  arguments: object
  expected_output: string

Errors:
  404: Tool not found
```

### 4.3 Execute Tool

Directly executes an Amplifier tool (used by OpenAI function calling).

```yaml
POST /execute/{tool_name}
Content-Type: application/json

Request:
  arguments: object        # Tool-specific arguments
  call_id?: string         # OpenAI function call ID
  timeout_ms?: integer     # Execution timeout (default: 60000)

Response: 200 OK
  success: boolean
  output: string           # Tool output (may be truncated)
  error?: string           # Error message if success=false
  duration_ms: integer
  truncated: boolean       # Whether output was truncated
  call_id?: string

Errors:
  400: Invalid arguments
  404: Tool not found
  408: Execution timeout
  500: Execution error
```

**Example Request:**
```json
{
  "arguments": {
    "agent": "foundation:explorer",
    "task": "Find all Python files in the src directory"
  },
  "call_id": "call_abc123"
}
```

**Example Response:**
```json
{
  "success": true,
  "output": "Found 15 Python files in src/...",
  "duration_ms": 2340,
  "truncated": false,
  "call_id": "call_abc123"
}
```

### 4.4 Tool Webhook (for OpenAI Data Channel)

Internal endpoint called when OpenAI sends function_call events.

```yaml
POST /webhook/tool-call
Content-Type: application/json
X-Session-ID: <voice_session_id>

Request:
  call_id: string
  name: string
  arguments: string        # JSON string from OpenAI

Response: 200 OK
  # Async processing - result sent via SSE/data channel
```

---

## 5. Event Streaming (SSE)

### 5.1 Event Stream Endpoint

Server-Sent Events for real-time updates to the client.

```yaml
GET /events
Accept: text/event-stream
X-Session-ID: <voice_session_id>

Response: 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

# Event format:
event: <event_type>
data: <json_payload>
id: <event_id>
```

### 5.2 Event Types

#### Session Events

```yaml
# Session started
event: session.started
data:
  session_id: string
  voice: string
  tools_count: integer
  timestamp: string

# Session updated
event: session.updated  
data:
  session_id: string
  changes: string[]      # What changed

# Session ended
event: session.ended
data:
  session_id: string
  reason: string         # "completed", "timeout", "error", "user_ended"
  duration_ms: integer
```

#### Conversation Events

```yaml
# Speech started (user speaking)
event: speech.started
data:
  timestamp: string

# Speech stopped (user finished)
event: speech.stopped
data:
  timestamp: string
  duration_ms: integer

# Transcription ready
event: transcription.completed
data:
  item_id: string
  transcript: string
  role: string           # "user" or "assistant"
  timestamp: string

# Assistant speaking
event: assistant.speaking
data:
  item_id: string
  timestamp: string

# Assistant finished speaking  
event: assistant.done
data:
  item_id: string
  duration_ms: integer
```

#### Tool Events

```yaml
# Tool execution started
event: tool.started
data:
  call_id: string
  tool_name: string
  description: string    # Human-readable "Running task..."
  timestamp: string

# Tool progress update
event: tool.progress
data:
  call_id: string
  tool_name: string
  message: string
  percentage?: integer   # 0-100
  timestamp: string

# Tool execution completed
event: tool.completed
data:
  call_id: string
  tool_name: string
  success: boolean
  duration_ms: integer
  output_preview?: string  # First 200 chars
  timestamp: string

# Tool execution failed
event: tool.error
data:
  call_id: string
  tool_name: string
  error: string
  recoverable: boolean
  suggestion?: string
  timestamp: string
```

#### Status Events

```yaml
# Connection status changed
event: connection.status
data:
  webrtc_state: string   # "connecting", "connected", "disconnected", "failed"
  data_channel_state: string
  timestamp: string

# Rate limit warning
event: rate_limit.warning
data:
  type: string           # "tokens", "requests"
  current: integer
  limit: integer
  reset_at: string       # ISO 8601

# Error occurred
event: error
data:
  code: string
  message: string
  recoverable: boolean
  timestamp: string
```

### 5.3 Event Subscription

Subscribe to specific event types:

```yaml
GET /events?subscribe=tool.*,session.*
Accept: text/event-stream

# Wildcards supported:
#   tool.*       - All tool events
#   session.*    - All session events
#   *            - All events (default)
```

### 5.4 Heartbeat

Keep connection alive with periodic heartbeats:

```yaml
# Server sends every 30 seconds:
event: heartbeat
data:
  timestamp: string
  session_active: boolean
```

---

## 6. Health & Status APIs

### 6.1 Health Check

Simple health check for load balancers.

```yaml
GET /health

Response: 200 OK
  status: string           # "healthy", "degraded", "unhealthy"
  version: string
  amplifier:
    enabled: boolean
    tools_count: integer
  model: string
  uptime_seconds: integer
```

**Example Response:**
```json
{
  "status": "healthy",
  "version": "0.2.0",
  "amplifier": {
    "enabled": true,
    "tools_count": 13
  },
  "model": "gpt-realtime",
  "uptime_seconds": 3600
}
```

### 6.2 Detailed Status

Comprehensive server status for monitoring dashboards.

```yaml
GET /status

Response: 200 OK
  server:
    status: string
    version: string
    uptime_seconds: integer
    started_at: string
  
  amplifier:
    enabled: boolean
    bundle: string
    cwd: string
    tools_count: integer
    tools: string[]
  
  sessions:
    active: integer
    total: integer
    avg_duration_ms: number
  
  openai:
    model: string
    voice: string
    connected: boolean
    last_error?: string
  
  resources:
    memory_mb: number
    cpu_percent: number
```

### 6.3 Readiness Check

Check if server is ready to accept requests.

```yaml
GET /ready

Response: 200 OK
  ready: boolean
  checks:
    amplifier: boolean
    openai: boolean
    database?: boolean

Response: 503 Service Unavailable
  ready: false
  checks: { ... }
  message: string
```

### 6.4 Metrics (Prometheus Format)

```yaml
GET /metrics
Accept: text/plain

Response: 200 OK
Content-Type: text/plain

# HELP voice_sessions_total Total voice sessions
# TYPE voice_sessions_total counter
voice_sessions_total 42

# HELP voice_sessions_active Current active sessions
# TYPE voice_sessions_active gauge
voice_sessions_active 3

# HELP tool_executions_total Total tool executions
# TYPE tool_executions_total counter
tool_executions_total{tool="task"} 156

# HELP tool_execution_duration_seconds Tool execution duration
# TYPE tool_execution_duration_seconds histogram
tool_execution_duration_seconds_bucket{tool="task",le="1"} 45
tool_execution_duration_seconds_bucket{tool="task",le="5"} 120
tool_execution_duration_seconds_bucket{tool="task",le="30"} 155
tool_execution_duration_seconds_bucket{tool="task",le="+Inf"} 156
```

---

## 7. Configuration APIs

### 7.1 Get Current Configuration

Returns current server configuration (non-sensitive).

```yaml
GET /config

Response: 200 OK
  service:
    version: string
    host: string
    port: integer
  
  realtime:
    model: string
    voice: string
    # instructions: REDACTED
  
  amplifier:
    bundle: string
    cwd: string
    auto_approve: boolean
    tool_timeout: number
    approval_policy: string
```

### 7.2 Update Session Configuration

Update configuration for a specific session.

```yaml
PATCH /config/session/{session_id}
Content-Type: application/json

Request:
  voice?: string
  instructions?: string
  turn_detection?: TurnDetectionConfig
  tools_enabled?: string[]

TurnDetectionConfig:
  type: string            # "server_vad", "semantic_vad", null (manual)
  threshold?: number      # 0.0-1.0 for server_vad
  eagerness?: string      # "low", "medium", "high" for semantic_vad
  silence_duration_ms?: integer
  prefix_padding_ms?: integer

Response: 200 OK
  session_id: string
  updated: string[]       # Fields that were updated
  effective_config: object
```

### 7.3 Get Voice Options

Returns available voice configurations.

```yaml
GET /config/voices

Response: 200 OK
  voices:
    - id: string          # "marin", "ash", etc.
      name: string        # Display name
      description: string
      recommended: boolean
      sample_url?: string
```

### 7.4 Get Turn Detection Options

```yaml
GET /config/turn-detection

Response: 200 OK
  options:
    - type: string
      name: string
      description: string
      parameters: ParameterSchema[]
```

---

## 8. Error Handling

### 8.1 Error Response Format

All errors follow a consistent format:

```yaml
Error Response:
  error:
    code: string          # Machine-readable error code
    message: string       # Human-readable message
    details?: object      # Additional context
    request_id?: string   # For support/debugging
    timestamp: string
```

### 8.2 Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `invalid_request` | Malformed request body |
| 400 | `invalid_arguments` | Invalid tool arguments |
| 400 | `invalid_sdp` | Invalid SDP format |
| 401 | `unauthorized` | Missing or invalid auth |
| 401 | `token_expired` | Ephemeral token expired |
| 403 | `forbidden` | Action not permitted |
| 404 | `not_found` | Resource not found |
| 404 | `session_not_found` | Session ID not found |
| 404 | `tool_not_found` | Tool name not found |
| 408 | `timeout` | Request timeout |
| 408 | `tool_timeout` | Tool execution timeout |
| 429 | `rate_limited` | Too many requests |
| 500 | `internal_error` | Server error |
| 502 | `openai_error` | OpenAI API error |
| 503 | `service_unavailable` | Service not ready |
| 503 | `amplifier_unavailable` | Amplifier not initialized |

### 8.3 Error Examples

**Invalid Request:**
```json
{
  "error": {
    "code": "invalid_arguments",
    "message": "Missing required parameter 'task' for tool 'task'",
    "details": {
      "tool": "task",
      "missing_params": ["task"]
    },
    "request_id": "req_abc123",
    "timestamp": "2026-01-31T14:30:22Z"
  }
}
```

**Service Unavailable:**
```json
{
  "error": {
    "code": "amplifier_unavailable",
    "message": "Amplifier bridge not initialized. Please try again in a moment.",
    "details": {
      "retry_after_ms": 5000
    },
    "request_id": "req_xyz789",
    "timestamp": "2026-01-31T14:30:22Z"
  }
}
```

---

## 9. OpenAPI Specification

```yaml
openapi: 3.1.0
info:
  title: Amplifier Voice Server API
  version: 1.0.0
  description: |
    Real-time voice assistant API powered by OpenAI Realtime and Microsoft Amplifier.
    
    ## Authentication
    
    Most endpoints require no authentication for development. WebRTC SDP exchange 
    requires an ephemeral token obtained from POST /session.
    
    ## WebRTC Flow
    
    1. POST /session - Get ephemeral token and tool configuration
    2. Create RTCPeerConnection on client
    3. POST /sdp with Authorization header - Exchange SDP
    4. Connect to SSE /events for real-time updates
  
  contact:
    name: Amplifier Voice Team
  license:
    name: MIT

servers:
  - url: http://localhost:8080
    description: Development server
  - url: https://voice.amplifier.dev
    description: Production server

tags:
  - name: Session
    description: Voice session management
  - name: WebRTC
    description: WebRTC signaling
  - name: Tools
    description: Amplifier tool management
  - name: Events
    description: Real-time event streaming
  - name: Health
    description: Server health and status
  - name: Config
    description: Configuration management

paths:
  /session:
    post:
      tags: [Session]
      summary: Create voice session
      description: Creates a new OpenAI Realtime session with Amplifier tools
      operationId: createSession
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateSessionRequest'
      responses:
        '200':
          description: Session created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SessionResponse'
        '503':
          $ref: '#/components/responses/ServiceUnavailable'

  /sessions:
    get:
      tags: [Session]
      summary: List sessions
      operationId: listSessions
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [active, completed, error]
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        '200':
          description: Session list
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SessionListResponse'
    
    post:
      tags: [Session]
      summary: Create tracked session
      operationId: createTrackedSession
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                title:
                  type: string
                metadata:
                  type: object
      responses:
        '201':
          description: Session created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CreateTrackedSessionResponse'

  /sessions/{session_id}:
    get:
      tags: [Session]
      summary: Get session details
      operationId: getSession
      parameters:
        - $ref: '#/components/parameters/SessionId'
      responses:
        '200':
          description: Session details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SessionDetailResponse'
        '404':
          $ref: '#/components/responses/NotFound'

  /sessions/{session_id}/transcript:
    post:
      tags: [Session]
      summary: Sync transcript entries
      operationId: syncTranscript
      parameters:
        - $ref: '#/components/parameters/SessionId'
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SyncTranscriptRequest'
      responses:
        '200':
          description: Transcript synced
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SyncTranscriptResponse'

  /sessions/{session_id}/resume:
    post:
      tags: [Session]
      summary: Resume session
      operationId: resumeSession
      parameters:
        - $ref: '#/components/parameters/SessionId'
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                voice:
                  type: string
      responses:
        '200':
          description: Session resumed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ResumeSessionResponse'
        '404':
          $ref: '#/components/responses/NotFound'

  /sdp:
    post:
      tags: [WebRTC]
      summary: Exchange SDP
      operationId: exchangeSdp
      security:
        - ephemeralToken: []
      requestBody:
        content:
          application/sdp:
            schema:
              type: string
      responses:
        '200':
          description: SDP answer
          content:
            application/sdp:
              schema:
                type: string
        '400':
          $ref: '#/components/responses/BadRequest'
        '401':
          $ref: '#/components/responses/Unauthorized'

  /tools:
    get:
      tags: [Tools]
      summary: List available tools
      operationId: listTools
      responses:
        '200':
          description: Tool list
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ToolListResponse'

  /tools/{tool_name}:
    get:
      tags: [Tools]
      summary: Get tool details
      operationId: getTool
      parameters:
        - name: tool_name
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Tool details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ToolDetailResponse'
        '404':
          $ref: '#/components/responses/NotFound'

  /execute/{tool_name}:
    post:
      tags: [Tools]
      summary: Execute tool
      operationId: executeTool
      parameters:
        - name: tool_name
          in: path
          required: true
          schema:
            type: string
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ExecuteToolRequest'
      responses:
        '200':
          description: Tool result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ExecuteToolResponse'
        '404':
          $ref: '#/components/responses/NotFound'
        '408':
          $ref: '#/components/responses/Timeout'

  /events:
    get:
      tags: [Events]
      summary: Event stream
      operationId: eventStream
      parameters:
        - name: subscribe
          in: query
          schema:
            type: string
            description: Comma-separated event patterns (e.g., "tool.*,session.*")
        - name: X-Session-ID
          in: header
          schema:
            type: string
      responses:
        '200':
          description: SSE stream
          content:
            text/event-stream:
              schema:
                type: string

  /health:
    get:
      tags: [Health]
      summary: Health check
      operationId: healthCheck
      responses:
        '200':
          description: Health status
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'

  /status:
    get:
      tags: [Health]
      summary: Detailed status
      operationId: getStatus
      responses:
        '200':
          description: Status details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/StatusResponse'

  /ready:
    get:
      tags: [Health]
      summary: Readiness check
      operationId: readinessCheck
      responses:
        '200':
          description: Ready
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ReadyResponse'
        '503':
          description: Not ready
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ReadyResponse'

  /config:
    get:
      tags: [Config]
      summary: Get configuration
      operationId: getConfig
      responses:
        '200':
          description: Configuration
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ConfigResponse'

  /config/voices:
    get:
      tags: [Config]
      summary: Get voice options
      operationId: getVoices
      responses:
        '200':
          description: Voice options
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/VoicesResponse'

components:
  securitySchemes:
    ephemeralToken:
      type: http
      scheme: bearer
      description: Ephemeral token from POST /session

  parameters:
    SessionId:
      name: session_id
      in: path
      required: true
      schema:
        type: string
      description: Voice session ID

  responses:
    BadRequest:
      description: Bad request
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    
    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    
    NotFound:
      description: Not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    
    Timeout:
      description: Request timeout
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'
    
    ServiceUnavailable:
      description: Service unavailable
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorResponse'

  schemas:
    CreateSessionRequest:
      type: object
      properties:
        voice:
          type: string
          enum: [marin, ash, coral, sage, cedar, alloy, echo, shimmer]
          default: marin
        instructions:
          type: string
        tools_filter:
          type: array
          items:
            type: string

    SessionResponse:
      type: object
      required: [client_secret, session_id, model, voice, tools]
      properties:
        client_secret:
          $ref: '#/components/schemas/ClientSecret'
        session_id:
          type: string
        model:
          type: string
        voice:
          type: string
        tools:
          type: array
          items:
            $ref: '#/components/schemas/ToolDefinition'

    ClientSecret:
      type: object
      required: [value, expires_at]
      properties:
        value:
          type: string
        expires_at:
          type: integer

    SessionInfo:
      type: object
      properties:
        id:
          type: string
        status:
          type: string
          enum: [active, completed, error]
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
        duration_ms:
          type: integer
        turn_count:
          type: integer
        title:
          type: string

    SessionListResponse:
      type: object
      properties:
        sessions:
          type: array
          items:
            $ref: '#/components/schemas/SessionInfo'
        count:
          type: integer

    CreateTrackedSessionResponse:
      type: object
      properties:
        session_id:
          type: string
        session:
          $ref: '#/components/schemas/SessionInfo'

    SessionDetailResponse:
      type: object
      properties:
        session:
          $ref: '#/components/schemas/SessionInfo'
        transcript:
          type: array
          items:
            $ref: '#/components/schemas/TranscriptEntry'

    TranscriptEntry:
      type: object
      properties:
        id:
          type: string
        entry_type:
          type: string
          enum: [user, assistant, tool_call, tool_result, system]
        timestamp:
          type: string
          format: date-time
        text:
          type: string
        tool_name:
          type: string
        tool_call_id:
          type: string
        tool_arguments:
          type: object
        tool_result:
          type: object
        audio_duration_ms:
          type: integer

    SyncTranscriptRequest:
      type: object
      required: [entries]
      properties:
        entries:
          type: array
          items:
            $ref: '#/components/schemas/TranscriptEntry'

    SyncTranscriptResponse:
      type: object
      properties:
        synced:
          type: integer
        session_id:
          type: string

    ResumeSessionResponse:
      type: object
      properties:
        session_id:
          type: string
        session:
          $ref: '#/components/schemas/SessionInfo'
        context_to_inject:
          type: array
          items:
            $ref: '#/components/schemas/ConversationItem'
        transcript:
          type: array
          items:
            $ref: '#/components/schemas/TranscriptEntry'
        realtime:
          $ref: '#/components/schemas/SessionResponse'

    ConversationItem:
      type: object
      properties:
        type:
          type: string
        role:
          type: string
        content:
          type: array
          items:
            type: object
            properties:
              type:
                type: string
              text:
                type: string

    ToolDefinition:
      type: object
      required: [type, name, description, parameters]
      properties:
        type:
          type: string
          enum: [function]
        name:
          type: string
        description:
          type: string
        parameters:
          type: object

    ToolListResponse:
      type: object
      properties:
        tools:
          type: array
          items:
            $ref: '#/components/schemas/ToolDefinition'
        count:
          type: integer
        categories:
          type: array
          items:
            type: object
            properties:
              name:
                type: string
              tools:
                type: array
                items:
                  type: string

    ToolDetailResponse:
      type: object
      properties:
        tool:
          $ref: '#/components/schemas/ToolDefinition'
        execution_stats:
          type: object
          properties:
            total_calls:
              type: integer
            avg_duration_ms:
              type: number
            success_rate:
              type: number
            last_called:
              type: string
              format: date-time
        examples:
          type: array
          items:
            type: object
            properties:
              description:
                type: string
              arguments:
                type: object
              expected_output:
                type: string

    ExecuteToolRequest:
      type: object
      required: [arguments]
      properties:
        arguments:
          type: object
        call_id:
          type: string
        timeout_ms:
          type: integer
          default: 60000

    ExecuteToolResponse:
      type: object
      properties:
        success:
          type: boolean
        output:
          type: string
        error:
          type: string
        duration_ms:
          type: integer
        truncated:
          type: boolean
        call_id:
          type: string

    HealthResponse:
      type: object
      properties:
        status:
          type: string
          enum: [healthy, degraded, unhealthy]
        version:
          type: string
        amplifier:
          type: object
          properties:
            enabled:
              type: boolean
            tools_count:
              type: integer
        model:
          type: string
        uptime_seconds:
          type: integer

    StatusResponse:
      type: object
      properties:
        server:
          type: object
        amplifier:
          type: object
        sessions:
          type: object
        openai:
          type: object
        resources:
          type: object

    ReadyResponse:
      type: object
      properties:
        ready:
          type: boolean
        checks:
          type: object
        message:
          type: string

    ConfigResponse:
      type: object
      properties:
        service:
          type: object
        realtime:
          type: object
        amplifier:
          type: object

    VoicesResponse:
      type: object
      properties:
        voices:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
              name:
                type: string
              description:
                type: string
              recommended:
                type: boolean
              sample_url:
                type: string

    ErrorResponse:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message, timestamp]
          properties:
            code:
              type: string
            message:
              type: string
            details:
              type: object
            request_id:
              type: string
            timestamp:
              type: string
              format: date-time
```

---

## 10. Sequence Diagrams

### 10.1 Session Creation & WebRTC Setup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SESSION CREATION & WEBRTC SETUP                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Browser              Voice Server              OpenAI              Amplifier│
│     │                      │                      │                     │   │
│     │ POST /session        │                      │                     │   │
│     │─────────────────────►│                      │                     │   │
│     │ {voice: "marin"}     │                      │                     │   │
│     │                      │                      │                     │   │
│     │                      │ get_tools()          │                     │   │
│     │                      │────────────────────────────────────────────►│   │
│     │                      │◄────────────────────────────────────────────│   │
│     │                      │ [tool definitions]   │                     │   │
│     │                      │                      │                     │   │
│     │                      │ POST /realtime/sessions                    │   │
│     │                      │─────────────────────►│                     │   │
│     │                      │ {model, voice, tools}│                     │   │
│     │                      │◄─────────────────────│                     │   │
│     │                      │ {client_secret}      │                     │   │
│     │                      │                      │                     │   │
│     │◄─────────────────────│                      │                     │   │
│     │ {client_secret,      │                      │                     │   │
│     │  session_id, tools}  │                      │                     │   │
│     │                      │                      │                     │   │
│     │ new RTCPeerConnection()                     │                     │   │
│     │ createOffer()        │                      │                     │   │
│     │                      │                      │                     │   │
│     │ POST /sdp            │                      │                     │   │
│     │─────────────────────►│                      │                     │   │
│     │ Authorization: ek_...│                      │                     │   │
│     │ Body: SDP offer      │                      │                     │   │
│     │                      │ POST /realtime/calls │                     │   │
│     │                      │─────────────────────►│                     │   │
│     │                      │ {sdp: offer}         │                     │   │
│     │                      │◄─────────────────────│                     │   │
│     │                      │ {sdp: answer}        │                     │   │
│     │◄─────────────────────│                      │                     │   │
│     │ SDP answer           │                      │                     │   │
│     │                      │                      │                     │   │
│     │ setRemoteDescription()                      │                     │   │
│     │                      │                      │                     │   │
│     │◄═══════════════════WebRTC Audio══════════════►│                   │   │
│     │                      │                      │                     │   │
│     │ GET /events          │                      │                     │   │
│     │─────────────────────►│                      │                     │   │
│     │◄─ ─ ─ ─ ─ ─ ─ SSE ─ ─│                      │                     │   │
│     │                      │                      │                     │   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Voice Conversation with Tool Call

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VOICE CONVERSATION WITH TOOL CALL                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Browser              OpenAI               Voice Server           Amplifier │
│     │                    │                      │                     │     │
│     │ [User speaks: "Find Python files"]        │                     │     │
│     │                    │                      │                     │     │
│     │═══ Audio ══════════►│                     │                     │     │
│     │                    │                      │                     │     │
│     │◄─ speech_started ──│                      │                     │     │
│     │                    │                      │                     │     │
│     │◄─ speech_stopped ──│                      │                     │     │
│     │                    │                      │                     │     │
│     │◄─ transcription ───│                      │                     │     │
│     │   "Find Python..." │                      │                     │     │
│     │                    │                      │                     │     │
│     │                    │ [LLM Processing]     │                     │     │
│     │                    │                      │                     │     │
│     │◄─ function_call ───│                      │                     │     │
│     │   name: "task"     │                      │                     │     │
│     │   args: {...}      │                      │                     │     │
│     │                    │                      │                     │     │
│     │                    │──function_call────────►│                    │     │
│     │                    │                      │                     │     │
│     │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ ─ tool.started ──│                     │     │
│     │                    │                      │                     │     │
│     │                    │                      │ execute_tool()      │     │
│     │                    │                      │─────────────────────►│     │
│     │                    │                      │                     │     │
│     │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─ tool.progress ───│                     │     │
│     │                    │                      │                     │     │
│     │                    │                      │◄────────────────────│     │
│     │                    │                      │ {success, output}   │     │
│     │                    │                      │                     │     │
│     │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─ ─tool.completed ───│                     │     │
│     │                    │                      │                     │     │
│     │                    │◄──function_output────│                     │     │
│     │                    │                      │                     │     │
│     │                    │◄──response.create────│                     │     │
│     │                    │                      │                     │     │
│     │                    │ [LLM generates       │                     │     │
│     │                    │  spoken summary]     │                     │     │
│     │                    │                      │                     │     │
│     │◄══ Audio ═══════════│                     │                     │     │
│     │   "I found 15      │                      │                     │     │
│     │    Python files..."│                      │                     │     │
│     │                    │                      │                     │     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Session Resume Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SESSION RESUME FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Browser              Voice Server              OpenAI              Storage │
│     │                      │                      │                     │   │
│     │ GET /sessions        │                      │                     │   │
│     │─────────────────────►│                      │                     │   │
│     │                      │ list_sessions()      │                     │   │
│     │                      │────────────────────────────────────────────►│   │
│     │◄─────────────────────│                      │                     │   │
│     │ [{id, title, ...}]   │                      │                     │   │
│     │                      │                      │                     │   │
│     │ [User selects session to resume]            │                     │   │
│     │                      │                      │                     │   │
│     │ POST /sessions/{id}/resume                  │                     │   │
│     │─────────────────────►│                      │                     │   │
│     │ {voice: "marin"}     │                      │                     │   │
│     │                      │                      │                     │   │
│     │                      │ get_session()        │                     │   │
│     │                      │────────────────────────────────────────────►│   │
│     │                      │◄────────────────────────────────────────────│   │
│     │                      │ {session, transcript}│                     │   │
│     │                      │                      │                     │   │
│     │                      │ get_resumption_context()                   │   │
│     │                      │ [Generate conversation summary]            │   │
│     │                      │                      │                     │   │
│     │                      │ POST /realtime/sessions                    │   │
│     │                      │─────────────────────►│                     │   │
│     │                      │◄─────────────────────│                     │   │
│     │                      │ {client_secret}      │                     │   │
│     │                      │                      │                     │   │
│     │◄─────────────────────│                      │                     │   │
│     │ {session_id,         │                      │                     │   │
│     │  context_to_inject,  │                      │                     │   │
│     │  transcript,         │                      │                     │   │
│     │  realtime: {...}}    │                      │                     │   │
│     │                      │                      │                     │   │
│     │ [Display transcript in UI]                  │                     │   │
│     │ [Setup WebRTC as normal]                    │                     │   │
│     │                      │                      │                     │   │
│     │═══ WebRTC Connected ════════════════════════►│                    │   │
│     │                      │                      │                     │   │
│     │ conversation.item.create                    │                     │   │
│     │ (inject context)     │                      │                     │   │
│     │═════════════════════════════════════════════►│                    │   │
│     │                      │                      │                     │   │
│     │ [Session resumed with context]              │                     │   │
│     │                      │                      │                     │   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

### API Design Principles

1. **RESTful Design**: Standard HTTP methods and status codes
2. **Consistent Responses**: Uniform response structure across all endpoints
3. **Error Transparency**: Detailed error codes and messages
4. **Real-time Updates**: SSE for live event streaming
5. **Separation of Concerns**: Clear distinction between session, tools, and config

### Key Endpoints

| Priority | Endpoint | Purpose |
|----------|----------|---------|
| **Critical** | `POST /session` | Create voice session |
| **Critical** | `POST /sdp` | WebRTC SDP exchange |
| **Critical** | `POST /execute/{tool}` | Tool execution |
| **High** | `GET /events` | Real-time event stream |
| **High** | `GET /health` | Health check |
| **Medium** | `GET /sessions` | Session management |
| **Medium** | `POST /sessions/{id}/resume` | Session resume |
| **Low** | `GET /config` | Configuration info |

### Implementation Notes

1. **WebRTC Flow**: Always POST /session first, then use ephemeral token for /sdp
2. **SSE Connection**: Establish SSE connection before starting conversation
3. **Tool Execution**: Results are sent back to OpenAI, then spoken by assistant
4. **Session Resume**: Context is summarized and injected as system message
5. **Error Handling**: All errors include request_id for debugging

### Security Considerations

1. Never expose OPENAI_API_KEY to browser
2. Ephemeral tokens expire in 60 seconds
3. Validate all tool arguments server-side
4. Rate limit tool executions
5. Sanitize transcript data before storage

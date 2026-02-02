# Data Flow Architecture: Voice + Amplifier System

> **Date**: 2026-01-31
> **Status**: Architectural Design
> **Purpose**: Comprehensive data flow specifications for the Voice + Amplifier integration

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Audio Pipeline](#2-audio-pipeline)
3. [Event Flow Architecture](#3-event-flow-architecture)
4. [Tool Invocation Flow](#4-tool-invocation-flow)
5. [Context Synchronization](#5-context-synchronization)
6. [State Management](#6-state-management)
7. [Persistence Layer](#7-persistence-layer)
8. [Real-Time Updates](#8-real-time-updates)
9. [Error Propagation](#9-error-propagation)
10. [Data Contracts](#10-data-contracts)
11. [Sequence Diagrams](#11-sequence-diagrams)

---

## 1. System Overview

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              DATA FLOW OVERVIEW                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────┐     WebRTC      ┌─────────────┐    HTTPS     ┌─────────────────┐ │
│   │  User   │◄═══════════════►│   OpenAI    │◄════════════►│  Voice Server   │ │
│   │ Browser │    Audio/Data   │  Realtime   │   REST API   │   (FastAPI)     │ │
│   └────┬────┘                 └──────┬──────┘              └────────┬────────┘ │
│        │                             │                              │           │
│        │ HTTP                        │ Events (Data Channel)        │ Python    │
│        │                             │                              │           │
│        ▼                             ▼                              ▼           │
│   ┌─────────┐              ┌─────────────────┐            ┌─────────────────┐  │
│   │  React  │◄────────────►│  Event Router   │◄──────────►│   Amplifier     │  │
│   │   UI    │   SSE/WS     │  (Server-side)  │  Internal  │   Foundation    │  │
│   └─────────┘              └─────────────────┘            └─────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Data Responsibility |
|-----------|---------------------|
| **Browser Client** | Audio I/O, UI rendering, local state |
| **OpenAI Realtime** | Speech processing, LLM reasoning, tool decisions |
| **Voice Server** | Session management, tool execution, event routing |
| **Amplifier Foundation** | Tool implementation, file ops, bash execution |
| **Event Router** | Bidirectional event translation, filtering |

---

## 2. Audio Pipeline

### 2.1 Audio Input Flow (Microphone → OpenAI)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                         AUDIO INPUT PIPELINE                                   │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌──────────┐   ┌───────────┐  │
│  │Microphone│──►│  WebRTC   │──►│   Opus   │──►│  OpenAI  │──►│   VAD     │  │
│  │  Input   │   │  Capture  │   │ Encoding │   │  Server  │   │ Detection │  │
│  └──────────┘   └───────────┘   └──────────┘   └──────────┘   └─────┬─────┘  │
│                                                                      │        │
│  Format:        Echo Cancel     48kHz Opus    UDP/DTLS      Server VAD│       │
│  Raw PCM        AGC             Packets       Transport     or Manual │       │
│  48kHz          Noise Supp.                                          │        │
│                                                                      ▼        │
│                                                              ┌───────────┐    │
│                                                              │   STT     │    │
│                                                              │(Internal) │    │
│                                                              └─────┬─────┘    │
│                                                                    │          │
│                                                                    ▼          │
│                                                              ┌───────────┐    │
│                                                              │   LLM     │    │
│                                                              │ Processing│    │
│                                                              └───────────┘    │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

#### Audio Input Specifications

```yaml
audio_input:
  source: navigator.mediaDevices.getUserMedia
  constraints:
    audio:
      echoCancellation: true
      noiseSuppression: true
      autoGainControl: true
      sampleRate: 48000
      channelCount: 1
  
  webrtc_processing:
    codec: opus
    sample_rate: 48000
    bitrate: 24000-32000  # Adaptive
    fec: enabled  # Forward Error Correction
    dtx: disabled  # Discontinuous Transmission
  
  openai_internal:
    resample_to: 24000  # Internal processing rate
    format: pcm16
    token_rate: ~800 tokens/minute
```

### 2.2 Audio Output Flow (OpenAI → Speaker)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                         AUDIO OUTPUT PIPELINE                                  │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌───────────┐   ┌───────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐  │
│  │   LLM     │──►│   TTS     │──►│   Opus   │──►│  WebRTC  │──►│ Speaker  │  │
│  │ Response  │   │(Internal) │   │ Encoding │   │ Playback │   │  Output  │  │
│  └───────────┘   └───────────┘   └──────────┘   └──────────┘   └──────────┘  │
│                                                                                │
│  Text tokens     24kHz PCM       48kHz Opus     RTP/SRTP      Audio Element   │
│  streaming       streaming       packets        jitter buffer  autoplay       │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                        INTERRUPTION HANDLING                             │  │
│  ├─────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                          │  │
│  │  User Speaks During Playback:                                           │  │
│  │  1. VAD detects speech → speech_started event                           │  │
│  │  2. Server cancels current response → response.cancel                   │  │
│  │  3. Client tracks audio_played_ms                                       │  │
│  │  4. Client sends conversation.item.truncate(audio_end_ms)               │  │
│  │  5. Context reflects only what user actually heard                      │  │
│  │                                                                          │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

#### Audio Playback Tracking

```typescript
interface AudioPlaybackState {
  currentItemId: string | null;
  audioStartTime: number;       // When playback started
  audioBytesSent: number;       // Bytes sent to audio element
  audioBufferedMs: number;      // Estimated buffered duration
  lastPlayedMs: number;         // Calculated actual playback position
}

function calculatePlayedMs(state: AudioPlaybackState): number {
  const elapsed = Date.now() - state.audioStartTime;
  const bytesPerMs = 24000 * 2 / 1000;  // 24kHz, 16-bit
  const maxPlayedMs = state.audioBytesSent / bytesPerMs;
  return Math.min(elapsed, maxPlayedMs);
}
```

### 2.3 Audio Flow Timing

```
Timeline (typical conversation turn):

0ms      100ms    200ms    400ms    600ms    800ms    1200ms   2000ms+
│        │        │        │        │        │        │        │
▼        ▼        ▼        ▼        ▼        ▼        ▼        ▼
┌────────┬────────┬────────┬────────┬────────┬────────┬────────┬────────┐
│ User   │ WebRTC │ OpenAI │ VAD    │ LLM    │ TTS    │ Network│ Audio  │
│ speaks │ encode │ receive│ detect │ process│ stream │ deliver│ plays  │
└────────┴────────┴────────┴────────┴────────┴────────┴────────┴────────┘

Target: 600-800ms voice-to-voice latency for natural conversation
```

---

## 3. Event Flow Architecture

### 3.1 Event Categories

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EVENT TAXONOMY                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │   OPENAI EVENTS     │  │   SERVER EVENTS     │  │  AMPLIFIER EVENTS   │ │
│  │   (Data Channel)    │  │   (Internal)        │  │  (Tool Execution)   │ │
│  ├─────────────────────┤  ├─────────────────────┤  ├─────────────────────┤ │
│  │                     │  │                     │  │                     │ │
│  │ • session.created   │  │ • session_ready     │  │ • tool_start        │ │
│  │ • session.updated   │  │ • tool_requested    │  │ • tool_progress     │ │
│  │ • speech_started    │  │ • tool_completed    │  │ • tool_output       │ │
│  │ • speech_stopped    │  │ • context_updated   │  │ • tool_error        │ │
│  │ • transcription.*   │  │ • error             │  │ • display_message   │ │
│  │ • response.*        │  │                     │  │ • approval_request  │ │
│  │ • function_call.*   │  │                     │  │                     │ │
│  │ • error             │  │                     │  │                     │ │
│  │                     │  │                     │  │                     │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Event Routing Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EVENT ROUTING MATRIX                                 │
├───────────────────────┬─────────────┬─────────────┬─────────────────────────┤
│ Event Type            │ Origin      │ Destination │ Action                  │
├───────────────────────┼─────────────┼─────────────┼─────────────────────────┤
│ session.created       │ OpenAI      │ Server/UI   │ Initialize session      │
│ speech_started        │ OpenAI      │ UI          │ Show speaking indicator │
│ transcription.done    │ OpenAI      │ UI/Server   │ Display transcript      │
│ function_call.done    │ OpenAI      │ Server      │ Execute via Amplifier   │
│ response.audio.delta  │ OpenAI      │ UI (auto)   │ Play audio              │
│ response.done         │ OpenAI      │ Server/UI   │ Track token usage       │
│ error                 │ OpenAI      │ Server/UI   │ Handle error            │
│ tool_start            │ Amplifier   │ UI          │ Show tool executing     │
│ tool_progress         │ Amplifier   │ UI          │ Update progress         │
│ tool_output           │ Amplifier   │ OpenAI      │ Send function_output    │
│ tool_error            │ Amplifier   │ OpenAI/UI   │ Send error result       │
└───────────────────────┴─────────────┴─────────────┴─────────────────────────┘
```

### 3.3 Bidirectional Event Flow

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                    BIDIRECTIONAL EVENT FLOW                                    │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  Browser                OpenAI                Server               Amplifier   │
│     │                     │                     │                     │        │
│     │──── Audio ─────────►│                     │                     │        │
│     │                     │                     │                     │        │
│     │◄─ speech_started ───│                     │                     │        │
│     │                     │                     │                     │        │
│     │◄─ transcription ────│                     │                     │        │
│     │                     │                     │                     │        │
│     │                     │── function_call ───►│                     │        │
│     │                     │                     │                     │        │
│     │◄──────────────────────── tool_start ──────│                     │        │
│     │                     │                     │── execute_tool ────►│        │
│     │                     │                     │                     │        │
│     │◄──────────────────────── tool_progress ───│◄──── progress ──────│        │
│     │                     │                     │                     │        │
│     │                     │                     │◄──── result ────────│        │
│     │                     │◄─ function_output ──│                     │        │
│     │                     │                     │                     │        │
│     │◄─── response.* ─────│                     │                     │        │
│     │                     │                     │                     │        │
│     │◄──── Audio ─────────│                     │                     │        │
│     │                     │                     │                     │        │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Event Data Structures

```typescript
// OpenAI Event Types
interface OpenAIEvent {
  type: string;
  event_id: string;
  // Type-specific fields
}

interface FunctionCallDoneEvent extends OpenAIEvent {
  type: 'response.function_call_arguments.done';
  call_id: string;
  name: string;
  arguments: string;  // JSON string
}

interface TranscriptionEvent extends OpenAIEvent {
  type: 'conversation.item.input_audio_transcription.completed';
  item_id: string;
  transcript: string;
}

// Server Event Types  
interface ServerEvent {
  type: string;
  timestamp: number;
  session_id: string;
}

interface ToolExecutionEvent extends ServerEvent {
  type: 'tool_start' | 'tool_progress' | 'tool_complete' | 'tool_error';
  call_id: string;
  tool_name: string;
  status: 'started' | 'running' | 'completed' | 'failed';
  progress?: {
    message: string;
    percentage?: number;
  };
  result?: {
    success: boolean;
    output: string;
    error?: string;
  };
}

// Amplifier Event Types
interface AmplifierEvent {
  type: string;
  tool_name: string;
  timestamp: number;
}

interface ToolOutputEvent extends AmplifierEvent {
  type: 'tool_output';
  content: Array<{
    type: 'text' | 'image' | 'error';
    text?: string;
    data?: string;  // Base64 for images
  }>;
  is_error: boolean;
}
```

---

## 4. Tool Invocation Flow

### 4.1 Complete Tool Execution Lifecycle

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                       TOOL INVOCATION LIFECYCLE                                │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  Phase 1: DECISION (OpenAI)                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ User: "Read the file src/main.py"                                       │  │
│  │                    │                                                     │  │
│  │                    ▼                                                     │  │
│  │ LLM reasons about request                                               │  │
│  │                    │                                                     │  │
│  │                    ▼                                                     │  │
│  │ LLM selects tool: read_file(path="src/main.py")                        │  │
│  │                    │                                                     │  │
│  │                    ▼                                                     │  │
│  │ Emit: response.function_call_arguments.done                             │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  Phase 2: ROUTING (Voice Server)                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ Receive function_call event                                             │  │
│  │                    │                                                     │  │
│  │                    ▼                                                     │  │
│  │ Parse: call_id, name, arguments                                         │  │
│  │                    │                                                     │  │
│  │                    ▼                                                     │  │
│  │ Notify UI: tool_start event                                             │  │
│  │                    │                                                     │  │
│  │                    ▼                                                     │  │
│  │ Route to Amplifier Bridge                                               │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  Phase 3: EXECUTION (Amplifier)                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ AmplifierBridge.execute_tool(name, arguments)                           │  │
│  │                    │                                                     │  │
│  │                    ▼                                                     │  │
│  │ Lookup tool in coordinator.tool_registry                                │  │
│  │                    │                                                     │  │
│  │                    ▼                                                     │  │
│  │ await tool_mount.call(**arguments)                                      │  │
│  │                    │                                                     │  │
│  │         ┌─────────┴─────────┐                                           │  │
│  │         ▼                   ▼                                           │  │
│  │    [Success]           [Failure]                                        │  │
│  │    Return result       Return error                                     │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  Phase 4: RESPONSE (Back to OpenAI)                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ Format result for OpenAI                                                │  │
│  │                    │                                                     │  │
│  │                    ▼                                                     │  │
│  │ Send: conversation.item.create(function_call_output)                    │  │
│  │                    │                                                     │  │
│  │                    ▼                                                     │  │
│  │ Send: response.create (trigger voice response)                          │  │
│  │                    │                                                     │  │
│  │                    ▼                                                     │  │
│  │ OpenAI generates spoken summary of result                               │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Tool Execution Code Flow

```python
# Voice Server: Tool Execution Handler

async def handle_function_call(event: FunctionCallEvent) -> None:
    """
    Handle function call from OpenAI, route to Amplifier, return result.
    """
    call_id = event.call_id
    tool_name = event.name
    arguments = json.loads(event.arguments)
    
    # Notify UI that tool execution started
    await broadcast_event({
        "type": "tool_start",
        "call_id": call_id,
        "tool_name": tool_name,
        "timestamp": time.time()
    })
    
    try:
        # Execute via Amplifier
        result = await amplifier_bridge.execute_tool(
            name=tool_name,
            arguments=arguments,
            timeout=60.0
        )
        
        # Format output for OpenAI
        output = format_tool_output(result)
        
        # Send result back to OpenAI
        await send_to_openai({
            "type": "conversation.item.create",
            "item": {
                "type": "function_call_output",
                "call_id": call_id,
                "output": output
            }
        })
        
        # Trigger response generation
        await send_to_openai({"type": "response.create"})
        
        # Notify UI of completion
        await broadcast_event({
            "type": "tool_complete",
            "call_id": call_id,
            "tool_name": tool_name,
            "success": True,
            "output_preview": output[:200]
        })
        
    except Exception as e:
        # Handle error
        error_output = f"Error executing {tool_name}: {str(e)}"
        
        await send_to_openai({
            "type": "conversation.item.create",
            "item": {
                "type": "function_call_output",
                "call_id": call_id,
                "output": error_output
            }
        })
        
        await send_to_openai({"type": "response.create"})
        
        await broadcast_event({
            "type": "tool_error",
            "call_id": call_id,
            "tool_name": tool_name,
            "error": str(e)
        })
```

### 4.3 Tool Result Formatting

```python
def format_tool_output(result: ToolResult) -> str:
    """
    Format Amplifier tool result for OpenAI consumption.
    
    Goals:
    - Concise enough for voice summarization
    - Complete enough for accurate response
    - Structured for LLM understanding
    """
    
    MAX_OUTPUT_LENGTH = 4000  # Tokens are precious
    
    if result.is_error:
        return f"Error: {result.error_message}"
    
    output = result.content
    
    # Truncate if too long
    if len(output) > MAX_OUTPUT_LENGTH:
        # Smart truncation for different content types
        if looks_like_code(output):
            output = truncate_code(output, MAX_OUTPUT_LENGTH)
        elif looks_like_file_list(output):
            output = truncate_file_list(output, MAX_OUTPUT_LENGTH)
        else:
            output = output[:MAX_OUTPUT_LENGTH] + "\n...[truncated]"
    
    return output
```

### 4.4 Tool Types and Handling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TOOL HANDLING MATRIX                                │
├─────────────────┬───────────────┬────────────────┬──────────────────────────┤
│ Tool            │ Execution     │ Output Format  │ Voice Response           │
│                 │ Time          │                │                          │
├─────────────────┼───────────────┼────────────────┼──────────────────────────┤
│ read_file       │ <100ms        │ File content   │ "Here's what I found..." │
│ glob            │ <500ms        │ File list      │ "Found N files matching" │
│ grep            │ <2s           │ Search results │ "Found matches in..."    │
│ write_file      │ <100ms        │ Success/error  │ "Done, I've written..."  │
│ edit_file       │ <100ms        │ Diff/success   │ "I've made the change"   │
│ bash            │ 1-60s         │ Command output │ Summarize result         │
│ web_search      │ 1-5s          │ Search results │ "I found information..." │
│ web_fetch       │ 1-10s         │ Page content   │ Summarize key points     │
│ task            │ 10-300s       │ Agent result   │ Summarize completion     │
└─────────────────┴───────────────┴────────────────┴──────────────────────────┘
```

---

## 5. Context Synchronization

### 5.1 Context Components

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                          CONTEXT ARCHITECTURE                                  │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                    VOICE SESSION CONTEXT (OpenAI)                        │  │
│  ├─────────────────────────────────────────────────────────────────────────┤  │
│  │  • System Instructions (2-3K tokens)                                    │  │
│  │  • Tool Definitions (~500 tokens per tool)                              │  │
│  │  • Conversation History (audio + text turns)                            │  │
│  │  • Current Response State                                               │  │
│  │                                                                          │  │
│  │  Limit: 32K tokens | Max Duration: 60 minutes                           │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                   AMPLIFIER SESSION CONTEXT                              │  │
│  ├─────────────────────────────────────────────────────────────────────────┤  │
│  │  • Working Directory (cwd)                                              │  │
│  │  • Loaded Bundles & Tools                                               │  │
│  │  • Active Tasks & Task History                                          │  │
│  │  • File Modification History                                            │  │
│  │  • Discoveries (DISCOVERIES.md)                                         │  │
│  │                                                                          │  │
│  │  Limit: None (long-lived) | Persists across voice sessions              │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                     SHARED/SYNCHRONIZED CONTEXT                          │  │
│  ├─────────────────────────────────────────────────────────────────────────┤  │
│  │  • Current File Focus (active files being discussed)                    │  │
│  │  • Recent Tool Results (cached for reference)                           │  │
│  │  • User Preferences                                                     │  │
│  │  • Task Status (running/completed/failed)                               │  │
│  │                                                                          │  │
│  │  Storage: In-memory + File-based persistence                            │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Context Synchronization Flow

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                      CONTEXT SYNC FLOW                                         │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  Voice Session Start:                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Load Amplifier session (or create new)                              │   │
│  │ 2. Get available tools from Amplifier                                  │   │
│  │ 3. Build system instructions with context                              │   │
│  │ 4. Create OpenAI session with tools + instructions                     │   │
│  │ 5. If resuming: inject conversation summary                            │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
│  During Conversation:                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                         │   │
│  │  Voice Context                    Amplifier Context                    │   │
│  │       │                                  │                              │   │
│  │       │  Tool call with context          │                              │   │
│  │       │─────────────────────────────────►│                              │   │
│  │       │                                  │                              │   │
│  │       │  Tool result                     │                              │   │
│  │       │◄─────────────────────────────────│                              │   │
│  │       │                                  │                              │   │
│  │       │  Context update (files changed)  │                              │   │
│  │       │◄ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                              │   │
│  │       │                                  │                              │   │
│  │  [Updates via tool results]     [Persists to disk]                     │   │
│  │                                                                         │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
│  Session End/Timeout:                                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │ 1. Summarize conversation (text only, audio lost)                      │   │
│  │ 2. Save summary to shared context                                      │   │
│  │ 3. Update task status in Amplifier                                     │   │
│  │ 4. Persist recoverable state                                           │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Context Injection Strategies

```python
class ContextManager:
    """Manages context synchronization between Voice and Amplifier."""
    
    def build_voice_instructions(self, amplifier_context: AmplifierContext) -> str:
        """
        Build system instructions for voice model with relevant context.
        """
        base_instructions = self.load_base_instructions()
        
        # Inject relevant Amplifier context
        context_sections = []
        
        # Current working directory
        context_sections.append(f"Working directory: {amplifier_context.cwd}")
        
        # Recent file context (if any files discussed)
        if amplifier_context.active_files:
            files = ", ".join(amplifier_context.active_files[:5])
            context_sections.append(f"Recently discussed files: {files}")
        
        # Active tasks
        if amplifier_context.running_tasks:
            tasks = "; ".join([
                f"{t.name}: {t.status}"
                for t in amplifier_context.running_tasks[:3]
            ])
            context_sections.append(f"Running tasks: {tasks}")
        
        # Session continuity
        if amplifier_context.previous_summary:
            context_sections.append(
                f"Previous conversation summary: {amplifier_context.previous_summary}"
            )
        
        # Combine
        context_block = "\n".join(context_sections)
        return f"{base_instructions}\n\n## Current Context\n{context_block}"
    
    def inject_context_update(self, update: ContextUpdate) -> None:
        """
        Inject a context update into the voice session.
        Uses system message for non-disruptive updates.
        """
        if update.priority == "high":
            # Critical update - inject as system message
            self.send_to_openai({
                "type": "conversation.item.create",
                "item": {
                    "type": "message",
                    "role": "system",
                    "content": [{"type": "input_text", "text": update.content}]
                }
            })
        else:
            # Low priority - queue for next natural break
            self.pending_context_updates.append(update)
```

---

## 6. State Management

### 6.1 State Hierarchy

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                           STATE HIERARCHY                                      │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                     APPLICATION STATE (Global)                           │  │
│  │  Lifetime: Application process                                          │  │
│  │  ─────────────────────────────────────────────────────────────────────  │  │
│  │  • Server configuration                                                 │  │
│  │  • Amplifier session pool                                               │  │
│  │  • Connection registry                                                  │  │
│  │  • Tool registry                                                        │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                    │                                           │
│                                    ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                      USER SESSION STATE                                  │  │
│  │  Lifetime: User's browser session                                       │  │
│  │  ─────────────────────────────────────────────────────────────────────  │  │
│  │  • User ID / Session ID                                                 │  │
│  │  • Preferences (voice, verbosity)                                       │  │
│  │  • Conversation history summary                                         │  │
│  │  • Task history                                                         │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                    │                                           │
│                                    ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                     VOICE SESSION STATE                                  │  │
│  │  Lifetime: Single OpenAI Realtime session (max 60 min)                  │  │
│  │  ─────────────────────────────────────────────────────────────────────  │  │
│  │  • OpenAI session ID                                                    │  │
│  │  • WebRTC connection state                                              │  │
│  │  • Data channel state                                                   │  │
│  │  • Current response state                                               │  │
│  │  • Audio playback tracking                                              │  │
│  │  • Active tool calls                                                    │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                    │                                           │
│                                    ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                        TASK STATE                                        │  │
│  │  Lifetime: Individual tool/task execution                               │  │
│  │  ─────────────────────────────────────────────────────────────────────  │  │
│  │  • Task ID / Call ID                                                    │  │
│  │  • Tool name and arguments                                              │  │
│  │  • Execution status                                                     │  │
│  │  • Progress updates                                                     │  │
│  │  • Result or error                                                      │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 State Transitions

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                    VOICE SESSION STATE MACHINE                                 │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│                         ┌─────────────┐                                       │
│                         │ INITIALIZING│                                       │
│                         └──────┬──────┘                                       │
│                                │ session.created                              │
│                                ▼                                              │
│                         ┌─────────────┐                                       │
│              ┌─────────►│   READY     │◄─────────┐                           │
│              │          └──────┬──────┘          │                           │
│              │                 │                 │                            │
│              │  response.done  │ speech_started  │ response.done              │
│              │                 ▼                 │                            │
│              │          ┌─────────────┐          │                            │
│              │          │  LISTENING  │          │                            │
│              │          └──────┬──────┘          │                            │
│              │                 │                 │                            │
│              │  speech_stopped │                 │                            │
│              │                 ▼                 │                            │
│       ┌──────┴──────┐   ┌─────────────┐         │                            │
│       │  SPEAKING   │◄──│ PROCESSING  │─────────┤                            │
│       └──────┬──────┘   └──────┬──────┘         │                            │
│              │                 │                 │                            │
│              │          function_call            │                            │
│              │                 ▼                 │                            │
│              │          ┌─────────────┐          │                            │
│              │          │  EXECUTING  │──────────┘                            │
│              │          │    TOOL     │ function_output                       │
│              │          └─────────────┘                                       │
│              │                                                                │
│              │ interrupted / error / timeout                                  │
│              ▼                                                                │
│       ┌─────────────┐                                                         │
│       │ RECONNECTING│──────► [INITIALIZING] or [TERMINATED]                  │
│       └─────────────┘                                                         │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 State Data Structures

```typescript
// Core State Interfaces

interface ApplicationState {
  server: {
    startTime: number;
    config: ServerConfig;
  };
  amplifier: {
    session: AmplifierSession;
    tools: ToolDefinition[];
  };
  connections: Map<string, ConnectionState>;
}

interface UserSessionState {
  userId: string;
  sessionId: string;
  createdAt: number;
  
  preferences: {
    voice: string;
    verbosity: 'brief' | 'normal' | 'detailed';
    autoApprove: boolean;
  };
  
  history: {
    conversationSummaries: ConversationSummary[];
    completedTasks: TaskSummary[];
    lastActiveAt: number;
  };
}

interface VoiceSessionState {
  sessionId: string;
  openaiSessionId: string;
  status: 'initializing' | 'ready' | 'listening' | 'processing' | 
          'speaking' | 'executing_tool' | 'reconnecting' | 'terminated';
  
  connection: {
    webrtcState: RTCPeerConnectionState;
    dataChannelState: RTCDataChannelState;
    connectedAt: number;
    lastEventAt: number;
  };
  
  audio: {
    currentItemId: string | null;
    playbackPosition: number;
    isPlaying: boolean;
  };
  
  conversation: {
    itemCount: number;
    estimatedTokens: number;
    lastUserTranscript: string;
    lastAssistantResponse: string;
  };
  
  tools: {
    pendingCalls: Map<string, ToolCallState>;
    recentResults: ToolResult[];
  };
}

interface ToolCallState {
  callId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  startedAt: number;
  progress?: {
    message: string;
    percentage?: number;
  };
  result?: {
    success: boolean;
    output: string;
    duration: number;
  };
}
```

---

## 7. Persistence Layer

### 7.1 Persistence Architecture

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                        PERSISTENCE ARCHITECTURE                                │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                      IN-MEMORY (Hot)                                     │  │
│  │  ─────────────────────────────────────────────────────────────────────  │  │
│  │  • Active voice sessions                                                │  │
│  │  • WebRTC connection states                                             │  │
│  │  • Pending tool calls                                                   │  │
│  │  • Event queues                                                         │  │
│  │  • Audio playback tracking                                              │  │
│  │                                                                          │  │
│  │  Characteristics: Fast, volatile, cleared on restart                    │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                    FILE SYSTEM (Warm)                                    │  │
│  │  ─────────────────────────────────────────────────────────────────────  │  │
│  │  • Session recovery data                                                │  │
│  │  • Conversation transcripts                                             │  │
│  │  • Tool execution logs                                                  │  │
│  │  • User preferences                                                     │  │
│  │                                                                          │  │
│  │  Location: ~/.amplifier-voice/ or project/.amplifier-voice/             │  │
│  │  Format: JSON files, log files                                          │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                   AMPLIFIER PERSISTENCE (Cold)                           │  │
│  │  ─────────────────────────────────────────────────────────────────────  │  │
│  │  • DISCOVERIES.md (project learnings)                                   │  │
│  │  • Task history                                                         │  │
│  │  • File modification history                                            │  │
│  │  • Agent outputs                                                        │  │
│  │                                                                          │  │
│  │  Location: Project directory (cwd)                                      │  │
│  │  Format: Markdown, structured files                                     │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 What Gets Saved Where

```yaml
persistence_map:
  
  in_memory_only:
    - webrtc_connection_state
    - audio_buffers
    - pending_events
    - active_response_state
    - real_time_audio_tracking
  
  session_file:
    location: "~/.amplifier-voice/sessions/{session_id}.json"
    contents:
      - session_id
      - user_id
      - created_at
      - voice_preference
      - conversation_summary
      - pending_tasks
      - last_context_snapshot
    retention: "24 hours"
  
  transcript_log:
    location: "~/.amplifier-voice/transcripts/{date}/{session_id}.log"
    contents:
      - timestamp
      - speaker (user/assistant)
      - transcript_text
      - tool_calls
      - tool_results
    retention: "7 days"
  
  amplifier_state:
    location: "project_cwd/"
    contents:
      DISCOVERIES.md: "Project learnings and patterns"
      .amplifier/tasks/: "Task execution history"
      .amplifier/context/: "Shared context files"
    retention: "permanent (project lifetime)"
```

### 7.3 Recovery Data Structure

```python
@dataclass
class SessionRecoveryData:
    """Data saved for session recovery after timeout/disconnect."""
    
    session_id: str
    user_id: str
    saved_at: float
    
    # Conversation state
    conversation_summary: str
    last_n_turns: List[ConversationTurn]  # Keep last 5 turns verbatim
    total_turns: int
    estimated_tokens: int
    
    # Context state
    active_files: List[str]
    working_directory: str
    
    # Task state
    pending_tasks: List[TaskState]
    completed_tasks: List[TaskSummary]
    
    # Preferences
    voice: str
    verbosity: str
    
    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2)
    
    @classmethod
    def from_json(cls, data: str) -> 'SessionRecoveryData':
        return cls(**json.loads(data))

@dataclass
class ConversationTurn:
    """Single conversation turn for recovery."""
    
    role: str  # "user" or "assistant"
    content: str  # Text transcript (audio is lost)
    tool_calls: Optional[List[dict]]
    timestamp: float
```

---

## 8. Real-Time Updates

### 8.1 Update Channels

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                       REAL-TIME UPDATE CHANNELS                                │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                   WEBRTC DATA CHANNEL (Primary)                          │  │
│  │  ─────────────────────────────────────────────────────────────────────  │  │
│  │  Direction: OpenAI ◄─► Browser                                          │  │
│  │  Content: OpenAI Realtime events                                        │  │
│  │  Latency: <50ms                                                         │  │
│  │                                                                          │  │
│  │  Events:                                                                 │  │
│  │  • session.*, response.*, conversation.*                                │  │
│  │  • input_audio_buffer.*, transcription.*                                │  │
│  │  • error, rate_limits.*                                                 │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                   SERVER-SENT EVENTS (Secondary)                         │  │
│  │  ─────────────────────────────────────────────────────────────────────  │  │
│  │  Direction: Server ──► Browser                                          │  │
│  │  Content: Amplifier events, server status                               │  │
│  │  Latency: <100ms                                                        │  │
│  │                                                                          │  │
│  │  Events:                                                                 │  │
│  │  • tool_start, tool_progress, tool_complete, tool_error                 │  │
│  │  • session_status, connection_status                                    │  │
│  │  • notification (general messages)                                      │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                     HTTP POLLING (Fallback)                              │  │
│  │  ─────────────────────────────────────────────────────────────────────  │  │
│  │  Direction: Browser ──► Server                                          │  │
│  │  Content: Status queries, task status                                   │  │
│  │  Interval: 5-30 seconds                                                 │  │
│  │                                                                          │  │
│  │  Endpoints:                                                              │  │
│  │  • GET /status - Server health                                          │  │
│  │  • GET /tasks/{id} - Task status                                        │  │
│  │  • GET /session - Session info                                          │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Update Event Types

```typescript
// Server → Browser Events (via SSE)

interface ToolStartEvent {
  type: 'tool_start';
  call_id: string;
  tool_name: string;
  description: string;  // Human-readable "Reading file src/main.py"
  estimated_duration?: number;  // milliseconds
}

interface ToolProgressEvent {
  type: 'tool_progress';
  call_id: string;
  tool_name: string;
  message: string;
  percentage?: number;  // 0-100
  details?: Record<string, unknown>;
}

interface ToolCompleteEvent {
  type: 'tool_complete';
  call_id: string;
  tool_name: string;
  success: boolean;
  duration: number;  // milliseconds
  output_preview?: string;  // First ~200 chars
}

interface ToolErrorEvent {
  type: 'tool_error';
  call_id: string;
  tool_name: string;
  error: string;
  recoverable: boolean;
  suggestion?: string;
}

interface SessionStatusEvent {
  type: 'session_status';
  voice_session_active: boolean;
  amplifier_connected: boolean;
  pending_tasks: number;
  session_age_ms: number;
  estimated_tokens: number;
}

interface NotificationEvent {
  type: 'notification';
  level: 'info' | 'warning' | 'error';
  message: string;
  action?: {
    label: string;
    handler: string;
  };
}
```

### 8.3 Progress Update Patterns

```python
class ProgressReporter:
    """
    Report progress for long-running tool executions.
    """
    
    def __init__(self, call_id: str, tool_name: str, broadcaster: EventBroadcaster):
        self.call_id = call_id
        self.tool_name = tool_name
        self.broadcaster = broadcaster
        self.started_at = time.time()
    
    async def report_start(self, description: str) -> None:
        await self.broadcaster.send({
            "type": "tool_start",
            "call_id": self.call_id,
            "tool_name": self.tool_name,
            "description": description,
        })
    
    async def report_progress(
        self, 
        message: str, 
        percentage: Optional[int] = None
    ) -> None:
        await self.broadcaster.send({
            "type": "tool_progress",
            "call_id": self.call_id,
            "tool_name": self.tool_name,
            "message": message,
            "percentage": percentage,
        })
    
    async def report_complete(self, success: bool, output_preview: str) -> None:
        duration = int((time.time() - self.started_at) * 1000)
        await self.broadcaster.send({
            "type": "tool_complete",
            "call_id": self.call_id,
            "tool_name": self.tool_name,
            "success": success,
            "duration": duration,
            "output_preview": output_preview[:200],
        })

# Usage in tool execution
async def execute_bash_with_progress(
    command: str,
    reporter: ProgressReporter
) -> str:
    await reporter.report_start(f"Running: {command[:50]}...")
    
    process = await asyncio.create_subprocess_shell(
        command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    
    output_lines = []
    async for line in process.stdout:
        output_lines.append(line.decode())
        if len(output_lines) % 10 == 0:
            await reporter.report_progress(
                f"Output: {len(output_lines)} lines...",
                percentage=None
            )
    
    await process.wait()
    output = "".join(output_lines)
    
    await reporter.report_complete(
        success=(process.returncode == 0),
        output_preview=output
    )
    
    return output
```

---

## 9. Error Propagation

### 9.1 Error Categories and Handling

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                         ERROR CLASSIFICATION                                   │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                    NETWORK ERRORS                                        │  │
│  │  ─────────────────────────────────────────────────────────────────────  │  │
│  │  Source: WebRTC, HTTP, WebSocket                                        │  │
│  │  Recovery: Automatic reconnection with backoff                          │  │
│  │  User Impact: Brief interruption, then resume                           │  │
│  │                                                                          │  │
│  │  Examples:                                                               │  │
│  │  • WebRTC ICE connection failed                                         │  │
│  │  • Data channel closed unexpectedly                                     │  │
│  │  • HTTP request timeout                                                 │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                    OPENAI API ERRORS                                     │  │
│  │  ─────────────────────────────────────────────────────────────────────  │  │
│  │  Source: OpenAI Realtime API                                            │  │
│  │  Recovery: Depends on error type                                        │  │
│  │  User Impact: Varies from retry to session restart                      │  │
│  │                                                                          │  │
│  │  Examples:                                                               │  │
│  │  • session_expired → Create new session, restore context                │  │
│  │  • rate_limit_exceeded → Backoff and retry                              │  │
│  │  • invalid_request_error → Report to user, log for debugging            │  │
│  │  • server_error → Retry with exponential backoff                        │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                    TOOL EXECUTION ERRORS                                 │  │
│  │  ─────────────────────────────────────────────────────────────────────  │  │
│  │  Source: Amplifier tool execution                                       │  │
│  │  Recovery: Return error to OpenAI, let model handle                     │  │
│  │  User Impact: Voice explains what went wrong                            │  │
│  │                                                                          │  │
│  │  Examples:                                                               │  │
│  │  • FileNotFoundError → "I couldn't find that file"                      │  │
│  │  • PermissionError → "I don't have permission to..."                    │  │
│  │  • TimeoutError → "That operation took too long"                        │  │
│  │  • CommandError → "The command failed with..."                          │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                    APPLICATION ERRORS                                    │  │
│  │  ─────────────────────────────────────────────────────────────────────  │  │
│  │  Source: Voice server, state management                                 │  │
│  │  Recovery: Log, attempt graceful recovery                               │  │
│  │  User Impact: May require refresh or reconnect                          │  │
│  │                                                                          │  │
│  │  Examples:                                                               │  │
│  │  • Amplifier bridge not initialized                                     │  │
│  │  • State corruption                                                     │  │
│  │  • Resource exhaustion                                                  │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Error Flow Diagram

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                          ERROR PROPAGATION FLOW                                │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  Error Occurs                                                                 │
│       │                                                                        │
│       ▼                                                                        │
│  ┌─────────────────┐                                                          │
│  │ Classify Error  │                                                          │
│  └────────┬────────┘                                                          │
│           │                                                                    │
│     ┌─────┴─────┬─────────────┬─────────────┐                                │
│     ▼           ▼             ▼             ▼                                │
│ [Network]   [OpenAI]      [Tool]      [Application]                          │
│     │           │             │             │                                │
│     ▼           ▼             ▼             ▼                                │
│ ┌───────┐   ┌───────┐     ┌───────┐     ┌───────┐                           │
│ │Retry? │   │Retry? │     │Return │     │ Log   │                           │
│ │ Yes   │   │Depends│     │Error  │     │Recover│                           │
│ └───┬───┘   └───┬───┘     │to API │     └───┬───┘                           │
│     │           │         └───┬───┘         │                                │
│     ▼           ▼             ▼             ▼                                │
│ ┌───────────────────────────────────────────────────┐                        │
│ │              Error Response Handler               │                        │
│ └───────────────────────────────────────────────────┘                        │
│                          │                                                    │
│           ┌──────────────┼──────────────┐                                    │
│           ▼              ▼              ▼                                    │
│     ┌──────────┐   ┌──────────┐   ┌──────────┐                              │
│     │ To Voice │   │  To UI   │   │  To Log  │                              │
│     │  Model   │   │ (Toast)  │   │ (Debug)  │                              │
│     └────┬─────┘   └──────────┘   └──────────┘                              │
│          │                                                                    │
│          ▼                                                                    │
│  ┌───────────────────────────────────────────────────┐                       │
│  │ Voice Model Generates User-Friendly Error Message │                       │
│  │ "I ran into a problem: {explanation}"             │                       │
│  │ "Would you like me to try a different approach?"  │                       │
│  └───────────────────────────────────────────────────┘                       │
│                                                                                │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Error Translation Table

```typescript
const ERROR_TRANSLATIONS: Record<string, ErrorTranslation> = {
  // Tool Errors
  'ENOENT': {
    userMessage: "I couldn't find that file. Would you like me to search for it?",
    recoverable: true,
    suggestion: 'Use glob to search'
  },
  'EACCES': {
    userMessage: "I don't have permission to access that. Is it a protected file?",
    recoverable: false,
    suggestion: null
  },
  'ETIMEDOUT': {
    userMessage: "That operation is taking too long. Should I keep trying?",
    recoverable: true,
    suggestion: 'Retry or abort'
  },
  
  // OpenAI Errors
  'session_expired': {
    userMessage: "Our session timed out. Let me reconnect and pick up where we left off.",
    recoverable: true,
    suggestion: 'Auto-reconnect'
  },
  'rate_limit_exceeded': {
    userMessage: "I need to slow down a bit. Give me a moment.",
    recoverable: true,
    suggestion: 'Auto-retry after delay'
  },
  'context_length_exceeded': {
    userMessage: "We've been talking for a while. Let me summarize our conversation so we can continue.",
    recoverable: true,
    suggestion: 'Summarize and truncate'
  },
  
  // Network Errors
  'connection_failed': {
    userMessage: "I lost connection briefly. Reconnecting now.",
    recoverable: true,
    suggestion: 'Auto-reconnect'
  },
  'audio_device_error': {
    userMessage: "I'm having trouble with the microphone. Could you check your audio settings?",
    recoverable: false,
    suggestion: 'User action required'
  }
};

interface ErrorTranslation {
  userMessage: string;
  recoverable: boolean;
  suggestion: string | null;
}
```

### 9.4 Error Recovery Strategies

```python
class ErrorRecoveryManager:
    """Manages error recovery strategies."""
    
    async def handle_error(self, error: Exception, context: ErrorContext) -> RecoveryAction:
        """
        Determine and execute appropriate recovery action.
        """
        error_type = self.classify_error(error)
        
        if error_type == ErrorType.NETWORK:
            return await self.handle_network_error(error, context)
        elif error_type == ErrorType.SESSION_EXPIRED:
            return await self.handle_session_expired(context)
        elif error_type == ErrorType.RATE_LIMIT:
            return await self.handle_rate_limit(context)
        elif error_type == ErrorType.TOOL_FAILURE:
            return await self.handle_tool_failure(error, context)
        else:
            return await self.handle_unknown_error(error, context)
    
    async def handle_session_expired(self, context: ErrorContext) -> RecoveryAction:
        """
        Handle session expiration:
        1. Save current state
        2. Create new session
        3. Restore context
        4. Notify user
        """
        # Save state before session dies
        recovery_data = context.session.create_recovery_data()
        await self.persistence.save_recovery_data(recovery_data)
        
        # Create new session
        new_session = await self.session_manager.create_session(
            voice=context.session.voice,
            tools=context.session.tools
        )
        
        # Inject conversation summary
        if recovery_data.conversation_summary:
            await new_session.inject_context(recovery_data.conversation_summary)
        
        # Notify through voice
        await new_session.speak(
            "I refreshed our connection. I remember what we were discussing."
        )
        
        return RecoveryAction(
            success=True,
            action_taken="session_recreated",
            new_session=new_session
        )
    
    async def handle_tool_failure(
        self, 
        error: Exception, 
        context: ErrorContext
    ) -> RecoveryAction:
        """
        Handle tool execution failure:
        1. Format error for voice model
        2. Send as function output
        3. Let model decide how to respond
        """
        translation = ERROR_TRANSLATIONS.get(
            error.__class__.__name__,
            {"userMessage": f"Something went wrong: {str(error)}", "recoverable": False}
        )
        
        # Return error to OpenAI as function output
        error_output = {
            "success": False,
            "error": translation["userMessage"],
            "recoverable": translation["recoverable"],
            "suggestion": translation.get("suggestion")
        }
        
        await context.send_function_output(
            call_id=context.call_id,
            output=json.dumps(error_output)
        )
        
        # Trigger response so model can explain to user
        await context.send_to_openai({"type": "response.create"})
        
        return RecoveryAction(
            success=True,
            action_taken="error_returned_to_model"
        )
```

---

## 10. Data Contracts

### 10.1 API Contracts

```yaml
# Voice Server API Contracts

endpoints:
  
  GET /session:
    description: "Create new voice session with Amplifier tools"
    request: null
    response:
      client_secret: string  # Ephemeral token for OpenAI
      session_id: string
      tools: ToolDefinition[]
      expires_at: number
    errors:
      500: "Amplifier initialization failed"
      503: "Service unavailable"
  
  POST /sdp:
    description: "Exchange WebRTC SDP with OpenAI"
    request:
      sdp: string  # SDP offer from browser
      session_id: string
    response:
      sdp: string  # SDP answer from OpenAI
    errors:
      400: "Invalid SDP"
      401: "Session expired"
  
  POST /execute/{tool_name}:
    description: "Execute tool via Amplifier (internal)"
    request:
      call_id: string
      arguments: object
    response:
      success: boolean
      output: string
      duration: number
    errors:
      400: "Invalid arguments"
      404: "Tool not found"
      408: "Execution timeout"
      500: "Execution error"
  
  GET /health:
    description: "Health check"
    response:
      status: "healthy" | "degraded" | "unhealthy"
      amplifier: boolean
      active_sessions: number
      uptime: number

sse_events:
  
  tool_start:
    call_id: string
    tool_name: string
    description: string
    timestamp: number
  
  tool_progress:
    call_id: string
    message: string
    percentage: number | null
    timestamp: number
  
  tool_complete:
    call_id: string
    success: boolean
    duration: number
    output_preview: string
    timestamp: number
  
  tool_error:
    call_id: string
    error: string
    recoverable: boolean
    timestamp: number
  
  session_status:
    active: boolean
    tokens_used: number
    session_age: number
    timestamp: number
```

### 10.2 Internal Data Contracts

```python
# Internal Data Contracts

@dataclass
class ToolDefinition:
    """Tool definition for OpenAI Realtime API."""
    type: str = "function"
    name: str = ""
    description: str = ""
    parameters: dict = field(default_factory=dict)
    
    def to_openai_format(self) -> dict:
        return {
            "type": self.type,
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters
        }

@dataclass
class ToolExecutionRequest:
    """Request to execute a tool."""
    call_id: str
    tool_name: str
    arguments: Dict[str, Any]
    timeout: float = 60.0
    
@dataclass
class ToolExecutionResult:
    """Result of tool execution."""
    call_id: str
    success: bool
    output: str
    duration_ms: int
    error: Optional[str] = None

@dataclass  
class VoiceSessionConfig:
    """Configuration for voice session."""
    voice: str = "marin"
    instructions: str = ""
    tools: List[ToolDefinition] = field(default_factory=list)
    turn_detection: dict = field(default_factory=lambda: {
        "type": "server_vad",
        "threshold": 0.5,
        "silence_duration_ms": 500
    })
    
@dataclass
class ConversationContext:
    """Context passed between Voice and Amplifier."""
    working_directory: str
    active_files: List[str]
    recent_tool_results: List[ToolExecutionResult]
    conversation_summary: Optional[str]
    user_preferences: Dict[str, Any]
```

---

## 11. Sequence Diagrams

### 11.1 Session Initialization

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                      SESSION INITIALIZATION SEQUENCE                           │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  Browser          Voice Server         OpenAI           Amplifier              │
│     │                  │                  │                 │                  │
│     │ GET /session     │                  │                 │                  │
│     │─────────────────►│                  │                 │                  │
│     │                  │                  │                 │                  │
│     │                  │ get_tools()      │                 │                  │
│     │                  │─────────────────────────────────────────────────────►│
│     │                  │                  │                 │                  │
│     │                  │◄─────────────────────────────────────────────────────│
│     │                  │ [tool definitions]                 │                  │
│     │                  │                  │                 │                  │
│     │                  │ POST /v1/realtime/client_secrets   │                  │
│     │                  │─────────────────►│                 │                  │
│     │                  │                  │                 │                  │
│     │                  │◄─────────────────│                 │                  │
│     │                  │ {client_secret}  │                 │                  │
│     │                  │                  │                 │                  │
│     │◄─────────────────│                  │                 │                  │
│     │ {client_secret,  │                  │                 │                  │
│     │  tools, session} │                  │                 │                  │
│     │                  │                  │                 │                  │
│     │ WebRTC Setup     │                  │                 │                  │
│     │═══════════════════════════════════►│                 │                  │
│     │                  │                  │                 │                  │
│     │◄═══════════════════════════════════│                 │                  │
│     │ session.created  │                  │                 │                  │
│     │                  │                  │                 │                  │
│     │ session.update   │                  │                 │                  │
│     │═══════════════════════════════════►│                 │                  │
│     │ (instructions,   │                  │                 │                  │
│     │  tools, config)  │                  │                 │                  │
│     │                  │                  │                 │                  │
│     │◄═══════════════════════════════════│                 │                  │
│     │ session.updated  │                  │                 │                  │
│     │                  │                  │                 │                  │
│     │ [SESSION READY - User can speak]   │                 │                  │
│     │                  │                  │                 │                  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 11.2 Voice Conversation with Tool Call

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                     CONVERSATION WITH TOOL CALL                                │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  Browser          OpenAI           Voice Server         Amplifier              │
│     │                │                  │                   │                  │
│     │ [User speaks: "Read the auth.py file"]               │                  │
│     │                │                  │                   │                  │
│     │ ═══ Audio ════►│                  │                   │                  │
│     │                │                  │                   │                  │
│     │◄═speech_started│                  │                   │                  │
│     │                │                  │                   │                  │
│     │◄═speech_stopped│                  │                   │                  │
│     │                │                  │                   │                  │
│     │◄═transcription │                  │                   │                  │
│     │  "Read the..." │                  │                   │                  │
│     │                │                  │                   │                  │
│     │                │ [LLM processing] │                   │                  │
│     │                │                  │                   │                  │
│     │◄═══════════════│                  │                   │                  │
│     │ function_call: │                  │                   │                  │
│     │ read_file      │                  │                   │                  │
│     │ {path:"auth.py"}                  │                   │                  │
│     │                │                  │                   │                  │
│     │                │─────────────────►│                   │                  │
│     │                │ function_call    │                   │                  │
│     │                │                  │                   │                  │
│     │◄──────────────────────────────────│                   │                  │
│     │ (SSE) tool_start                  │                   │                  │
│     │                │                  │                   │                  │
│     │                │                  │ execute_tool()    │                  │
│     │                │                  │──────────────────►│                  │
│     │                │                  │                   │                  │
│     │                │                  │◄──────────────────│                  │
│     │                │                  │ [file content]    │                  │
│     │                │                  │                   │                  │
│     │◄──────────────────────────────────│                   │                  │
│     │ (SSE) tool_complete               │                   │                  │
│     │                │                  │                   │                  │
│     │                │◄─────────────────│                   │                  │
│     │                │ function_output  │                   │                  │
│     │                │                  │                   │                  │
│     │                │◄─────────────────│                   │                  │
│     │                │ response.create  │                   │                  │
│     │                │                  │                   │                  │
│     │                │ [LLM generates   │                   │                  │
│     │                │  spoken summary] │                   │                  │
│     │                │                  │                   │                  │
│     │◄═══════════════│                  │                   │                  │
│     │ response.audio │                  │                   │                  │
│     │ "The auth.py   │                  │                   │                  │
│     │  file contains.│                  │                   │                  │
│     │                │                  │                   │                  │
│     │◄═══ Audio ═════│                  │                   │                  │
│     │                │                  │                   │                  │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 11.3 Error Recovery Flow

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                        ERROR RECOVERY SEQUENCE                                 │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  Browser          OpenAI           Voice Server         Recovery               │
│     │                │                  │                   │                  │
│     │                │ [Session expires after 60 min]      │                  │
│     │                │                  │                   │                  │
│     │◄═══════════════│                  │                   │                  │
│     │ error:         │                  │                   │                  │
│     │ session_expired│                  │                   │                  │
│     │                │                  │                   │                  │
│     │────────────────────────────────────────────────────►│                  │
│     │ Handle session_expired            │                   │                  │
│     │                │                  │                   │                  │
│     │                │                  │                   │                  │
│     │                │                  │◄──────────────────│                  │
│     │                │                  │ save_recovery_data│                  │
│     │                │                  │                   │                  │
│     │ GET /session   │                  │                   │                  │
│     │───────────────────────────────────►                  │                  │
│     │                │                  │                   │                  │
│     │◄──────────────────────────────────│                   │                  │
│     │ {new client_secret}               │                   │                  │
│     │                │                  │                   │                  │
│     │ WebRTC Reconnect                  │                   │                  │
│     │═══════════════►│                  │                   │                  │
│     │                │                  │                   │                  │
│     │◄═══════════════│                  │                   │                  │
│     │ session.created│                  │                   │                  │
│     │                │                  │                   │                  │
│     │ session.update │                  │                   │                  │
│     │═══════════════►│                  │                   │                  │
│     │ (restore context)                 │                   │                  │
│     │                │                  │                   │                  │
│     │ conversation.  │                  │                   │                  │
│     │ item.create    │                  │                   │                  │
│     │═══════════════►│                  │                   │                  │
│     │ (inject summary)                  │                   │                  │
│     │                │                  │                   │                  │
│     │ response.create│                  │                   │                  │
│     │═══════════════►│                  │                   │                  │
│     │ (prompt: "I've reconnected...")   │                   │                  │
│     │                │                  │                   │                  │
│     │◄═══════════════│                  │                   │                  │
│     │ Audio: "I've   │                  │                   │                  │
│     │ reconnected..."│                  │                   │                  │
│     │                │                  │                   │                  │
│     │ [SESSION RESTORED]                │                   │                  │
│     │                │                  │                   │                  │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

### Key Data Flow Principles

1. **Audio flows directly** between browser and OpenAI via WebRTC (lowest latency)
2. **Control events** flow through the data channel (OpenAI events) and SSE (server events)
3. **Tool execution** is synchronous from OpenAI's perspective but async internally
4. **Context** is synchronized at session boundaries and through tool results
5. **State** is hierarchical: app → user → voice → task
6. **Persistence** is tiered: hot (memory) → warm (files) → cold (Amplifier)
7. **Errors** propagate to voice model for user-friendly explanations
8. **Recovery** is automatic where possible, graceful where not

### Implementation Priority

1. **Phase 1**: Basic audio pipeline + tool execution flow
2. **Phase 2**: Real-time updates + progress reporting
3. **Phase 3**: Context synchronization + session recovery
4. **Phase 4**: Error handling + resilience
5. **Phase 5**: Persistence + long conversation support

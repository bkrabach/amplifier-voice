# Conversation State Machine

> **Date**: 2026-01-31
> **Status**: Architectural Design
> **Purpose**: Define finite state machine for voice conversation lifecycle management

---

## Table of Contents

1. [Overview](#1-overview)
2. [State Definitions](#2-state-definitions)
3. [State Transition Diagram](#3-state-transition-diagram)
4. [Detailed State Specifications](#4-detailed-state-specifications)
5. [Transition Matrix](#5-transition-matrix)
6. [Error Recovery Flows](#6-error-recovery-flows)
7. [Implementation Considerations](#7-implementation-considerations)

---

## 1. Overview

### Purpose

The conversation state machine governs the lifecycle of a voice conversation session, ensuring:
- Predictable behavior across all interaction scenarios
- Graceful handling of interruptions, errors, and timeouts
- Clear coordination between UI, OpenAI Realtime, and Amplifier

### State Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CONVERSATION STATES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌──────────┐                │
│   │   IDLE   │  │ LISTENING │  │ PROCESSING │  │ SPEAKING │                │
│   │          │  │           │  │            │  │          │                │
│   │ Waiting  │  │ Capturing │  │ LLM thinks │  │ Playing  │                │
│   │ for user │  │   audio   │  │            │  │  audio   │                │
│   └──────────┘  └───────────┘  └────────────┘  └──────────┘                │
│                                                                             │
│   ┌────────────────┐  ┌───────────────────┐                                │
│   │ TOOL_EXECUTING │  │ WAITING_AMPLIFIER │                                │
│   │                │  │                   │                                │
│   │  Running tool  │  │  Agent working    │                                │
│   │   (instant)    │  │  (long-running)   │                                │
│   └────────────────┘  └───────────────────┘                                │
│                                                                             │
│   ┌─────────┐  ┌──────────────┐                                            │
│   │  ERROR  │  │ RECONNECTING │                                            │
│   │         │  │              │                                            │
│   │ Handle  │  │  Session     │                                            │
│   │ failure │  │  recovery    │                                            │
│   └─────────┘  └──────────────┘                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. State Definitions

| State | Description | Typical Duration |
|-------|-------------|------------------|
| `IDLE` | Session active but no interaction occurring | Indefinite |
| `LISTENING` | Actively capturing user speech via VAD | 0.5s - 30s |
| `PROCESSING` | LLM generating response (pre-audio) | 200ms - 2s |
| `SPEAKING` | Audio response playing to user | 1s - 60s |
| `TOOL_EXECUTING` | Running a quick tool (read_file, web_search) | 50ms - 5s |
| `WAITING_AMPLIFIER` | Long-running Amplifier agent task | 5s - 5min |
| `ERROR` | Handling a recoverable error condition | 1s - 10s |
| `RECONNECTING` | Session dropped, attempting recovery | 1s - 30s |

---

## 3. State Transition Diagram

### Primary Flow (Happy Path)

```
                              ┌─────────────────────────────────────┐
                              │                                     │
                              ▼                                     │
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                    ┌─────────────┐                                           │
│     session.create │             │ session.end                               │
│    ───────────────►│    IDLE     │◄────────────────────────────────────┐     │
│                    │             │                                     │     │
│                    └──────┬──────┘                                     │     │
│                           │                                            │     │
│                           │ input_audio_buffer.speech_started          │     │
│                           │ (VAD detects speech)                       │     │
│                           ▼                                            │     │
│                    ┌─────────────┐                                     │     │
│                    │             │                                     │     │
│                    │  LISTENING  │◄───────────────────────────┐        │     │
│                    │             │                            │        │     │
│                    └──────┬──────┘                            │        │     │
│                           │                                   │        │     │
│                           │ input_audio_buffer.speech_stopped │        │     │
│                           │ (VAD detects silence)             │        │     │
│                           ▼                                   │        │     │
│                    ┌─────────────┐                            │        │     │
│                    │             │ response.function_call     │        │     │
│                    │ PROCESSING  │────────────────────┐       │        │     │
│                    │             │                    │       │        │     │
│                    └──────┬──────┘                    │       │        │     │
│                           │                          │       │        │     │
│                           │ response.audio.delta     │       │        │     │
│                           │ (first audio chunk)      │       │        │     │
│                           ▼                          ▼       │        │     │
│                    ┌─────────────┐           ┌──────────────┐│        │     │
│                    │             │           │    TOOL_     ││        │     │
│                    │  SPEAKING   │           │  EXECUTING   │┼────────┤     │
│                    │             │           │              ││ done   │     │
│                    └──────┬──────┘           └──────┬───────┘│        │     │
│                           │                        │         │        │     │
│                           │ response.audio.done    │ task()  │        │     │
│                           │                        ▼         │        │     │
│                           │                 ┌──────────────┐ │        │     │
│                           │                 │   WAITING_   │ │        │     │
│                           │                 │  AMPLIFIER   │─┘        │     │
│                           │                 │              │          │     │
│                           │                 └──────────────┘          │     │
│                           │                                           │     │
│                           └───────────────────────────────────────────┘     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Interruption Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INTERRUPTION HANDLING                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   User speaks while assistant is speaking:                                  │
│                                                                             │
│   ┌──────────┐  speech_started   ┌───────────┐                             │
│   │ SPEAKING │──────────────────►│ LISTENING │                             │
│   │          │                   │           │                             │
│   └──────────┘                   └───────────┘                             │
│        │                               │                                    │
│        │ Actions on interrupt:         │                                    │
│        │ 1. response.cancel            │                                    │
│        │ 2. Calculate audio_played_ms  │                                    │
│        │ 3. conversation.item.truncate │                                    │
│        │ 4. Stop audio playback        │                                    │
│                                                                             │
│   User speaks during tool execution:                                        │
│                                                                             │
│   ┌────────────────┐  speech_started  ┌───────────┐                        │
│   │ TOOL_EXECUTING │─────────────────►│ LISTENING │                        │
│   │                │                  │ (queued)  │                        │
│   └────────────────┘                  └───────────┘                        │
│        │                                    │                               │
│        │ Tool continues in background       │                               │
│        │ User input processed after         │                               │
│        │ tool completion                    │                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Error and Recovery Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ERROR & RECOVERY PATHS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                    ┌─────────────────┐                                      │
│   ANY STATE ──────►│      ERROR      │                                      │
│                    │                 │                                      │
│   Triggers:        └────────┬────────┘                                      │
│   - WebRTC failure          │                                               │
│   - Tool exception          │                                               │
│   - API error               │                                               │
│   - Invalid state           ├──────────────────┐                            │
│                             │                  │                            │
│              recoverable?   │                  │ unrecoverable              │
│                             ▼                  ▼                            │
│                    ┌─────────────────┐  ┌─────────────┐                     │
│                    │  RECONNECTING   │  │    IDLE     │                     │
│                    │                 │  │  (notify)   │                     │
│                    └────────┬────────┘  └─────────────┘                     │
│                             │                                               │
│              success?       │                                               │
│              ┌──────────────┼──────────────┐                                │
│              │              │              │                                │
│              ▼              ▼              ▼                                │
│       ┌──────────┐   ┌──────────┐   ┌──────────┐                           │
│       │   IDLE   │   │  ERROR   │   │   IDLE   │                           │
│       │(restored)│   │ (retry)  │   │ (failed) │                           │
│       └──────────┘   └──────────┘   └──────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed State Specifications

### 4.1 IDLE

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STATE: IDLE                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ENTRY CONDITIONS:                                                           │
│   • Session successfully established (session.created event)                │
│   • Response completed and no pending user input                            │
│   • Error recovery completed                                                │
│   • Reconnection successful                                                 │
│                                                                             │
│ EXIT TRANSITIONS:                                                           │
│   ┌────────────────────────────┬─────────────────┬────────────────────────┐ │
│   │ Trigger                    │ Target State    │ Condition              │ │
│   ├────────────────────────────┼─────────────────┼────────────────────────┤ │
│   │ speech_started             │ LISTENING       │ VAD enabled            │ │
│   │ manual_push_to_talk        │ LISTENING       │ PTT mode               │ │
│   │ session.error              │ ERROR           │ Always                 │ │
│   │ connection.lost            │ RECONNECTING    │ WebRTC disconnect      │ │
│   │ session.end (user)         │ [terminated]    │ User ends session      │ │
│   └────────────────────────────┴─────────────────┴────────────────────────┘ │
│                                                                             │
│ TIMEOUT BEHAVIOR:                                                           │
│   • 15 min session limit → RECONNECTING (with context preservation)         │
│   • 5 min inactivity → Optional "still there?" prompt                       │
│   • No hard timeout in IDLE state itself                                    │
│                                                                             │
│ ACTIONS ON ENTRY:                                                           │
│   • Update UI: "Ready to listen" indicator                                  │
│   • Enable microphone VAD monitoring                                        │
│   • Clear any pending audio buffers                                         │
│   • Reset interruption tracking state                                       │
│                                                                             │
│ ACTIONS ON EXIT:                                                            │
│   • Log state transition with timestamp                                     │
│   • Capture entry reason for debugging                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 LISTENING

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STATE: LISTENING                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ENTRY CONDITIONS:                                                           │
│   • VAD detected speech start (input_audio_buffer.speech_started)           │
│   • Push-to-talk button pressed                                             │
│   • User interrupted during SPEAKING state                                  │
│                                                                             │
│ EXIT TRANSITIONS:                                                           │
│   ┌────────────────────────────┬─────────────────┬────────────────────────┐ │
│   │ Trigger                    │ Target State    │ Condition              │ │
│   ├────────────────────────────┼─────────────────┼────────────────────────┤ │
│   │ speech_stopped             │ PROCESSING      │ VAD silence threshold  │ │
│   │ push_to_talk_release       │ PROCESSING      │ PTT mode               │ │
│   │ manual_send                │ PROCESSING      │ User clicks send       │ │
│   │ session.error              │ ERROR           │ Always                 │ │
│   │ connection.lost            │ RECONNECTING    │ WebRTC disconnect      │ │
│   │ max_duration_exceeded      │ PROCESSING      │ 30s safety limit       │ │
│   └────────────────────────────┴─────────────────┴────────────────────────┘ │
│                                                                             │
│ TIMEOUT BEHAVIOR:                                                           │
│   • 30s max listening duration → Force transition to PROCESSING             │
│   • 500ms silence threshold (VAD) → Transition to PROCESSING                │
│   • Configurable via session.turn_detection settings                        │
│                                                                             │
│ ACTIONS ON ENTRY:                                                           │
│   • Update UI: Pulsing microphone indicator                                 │
│   • Begin audio buffer accumulation                                         │
│   • Start listening duration timer                                          │
│   • If interrupted SPEAKING: cancel current response                        │
│   • Emit: conversation.item.input_audio_transcription.started (if enabled)  │
│                                                                             │
│ ACTIONS ON EXIT:                                                            │
│   • Commit audio buffer (input_audio_buffer.commit)                         │
│   • Stop listening timer                                                    │
│   • Update UI: Processing indicator                                         │
│   • Log audio duration for analytics                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 PROCESSING

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STATE: PROCESSING                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ENTRY CONDITIONS:                                                           │
│   • Audio buffer committed after speech end                                 │
│   • Explicit response.create request                                        │
│   • Tool result submitted, awaiting LLM continuation                        │
│                                                                             │
│ EXIT TRANSITIONS:                                                           │
│   ┌────────────────────────────┬─────────────────┬────────────────────────┐ │
│   │ Trigger                    │ Target State    │ Condition              │ │
│   ├────────────────────────────┼─────────────────┼────────────────────────┤ │
│   │ response.audio.delta       │ SPEAKING        │ Audio output begins    │ │
│   │ response.function_call     │ TOOL_EXECUTING  │ Tool invocation        │ │
│   │ response.text.done         │ IDLE            │ Text-only response     │ │
│   │ speech_started             │ LISTENING       │ User interrupts        │ │
│   │ session.error              │ ERROR           │ Always                 │ │
│   │ response.error             │ ERROR           │ LLM error              │ │
│   └────────────────────────────┴─────────────────┴────────────────────────┘ │
│                                                                             │
│ TIMEOUT BEHAVIOR:                                                           │
│   • 30s max processing time → ERROR (LLM_TIMEOUT)                           │
│   • Expected: 200ms - 2s for typical responses                              │
│   • Long processing may indicate complex reasoning                          │
│                                                                             │
│ ACTIONS ON ENTRY:                                                           │
│   • Update UI: "Thinking..." indicator                                      │
│   • Start processing timer                                                  │
│   • Request response if not auto-generated                                  │
│   • Prepare audio playback pipeline                                         │
│                                                                             │
│ ACTIONS ON EXIT:                                                            │
│   • Log processing duration                                                 │
│   • Stop processing timer                                                   │
│   • Emit metrics: time_to_first_token                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.4 SPEAKING

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STATE: SPEAKING                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ENTRY CONDITIONS:                                                           │
│   • First audio delta received from response                                │
│   • Response resumed after tool completion                                  │
│                                                                             │
│ EXIT TRANSITIONS:                                                           │
│   ┌────────────────────────────┬─────────────────┬────────────────────────┐ │
│   │ Trigger                    │ Target State    │ Condition              │ │
│   ├────────────────────────────┼─────────────────┼────────────────────────┤ │
│   │ response.audio.done        │ IDLE            │ Playback complete      │ │
│   │ response.function_call     │ TOOL_EXECUTING  │ Mid-response tool      │ │
│   │ speech_started             │ LISTENING       │ User interrupts        │ │
│   │ session.error              │ ERROR           │ Always                 │ │
│   │ playback_error             │ ERROR           │ Audio system failure   │ │
│   └────────────────────────────┴─────────────────┴────────────────────────┘ │
│                                                                             │
│ TIMEOUT BEHAVIOR:                                                           │
│   • 120s max speaking duration → Unusual, log warning                       │
│   • No hard timeout (allow long explanations)                               │
│   • Audio buffer underrun → Brief pause, continue                           │
│                                                                             │
│ ACTIONS ON ENTRY:                                                           │
│   • Update UI: Speaking animation, waveform display                         │
│   • Initialize audio playback tracking                                      │
│   • Record playback_start_time                                              │
│   • Begin tracking audio_bytes_played                                       │
│                                                                             │
│ ACTIONS ON EXIT:                                                            │
│   • If interrupted:                                                         │
│     - Calculate audio_played_ms = (now - playback_start_time)               │
│     - Send conversation.item.truncate(item_id, audio_end_ms)                │
│     - Cancel current response                                               │
│   • Stop audio playback                                                     │
│   • Log total speaking duration                                             │
│   • Update conversation transcript with actual spoken content               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 TOOL_EXECUTING

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STATE: TOOL_EXECUTING                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ENTRY CONDITIONS:                                                           │
│   • response.output_item.done with type="function_call"                     │
│   • Tool is NOT the `task` tool (instant tools only)                        │
│   • Examples: read_file, web_search, glob, grep                             │
│                                                                             │
│ EXIT TRANSITIONS:                                                           │
│   ┌────────────────────────────┬─────────────────┬────────────────────────┐ │
│   │ Trigger                    │ Target State    │ Condition              │ │
│   ├────────────────────────────┼─────────────────┼────────────────────────┤ │
│   │ tool_result_submitted      │ PROCESSING      │ Result → LLM           │ │
│   │ tool_is_task               │ WAITING_AMP...  │ Long-running task      │ │
│   │ tool_error                 │ ERROR           │ Tool threw exception   │ │
│   │ session.error              │ ERROR           │ Session failure        │ │
│   │ execution_timeout          │ ERROR           │ 30s limit exceeded     │ │
│   └────────────────────────────┴─────────────────┴────────────────────────┘ │
│                                                                             │
│ TIMEOUT BEHAVIOR:                                                           │
│   • 30s execution timeout → ERROR with partial result if available          │
│   • Expected: 50ms - 5s for most tools                                      │
│   • web_fetch may take longer (network dependent)                           │
│                                                                             │
│ ACTIONS ON ENTRY:                                                           │
│   • Update UI: Tool execution indicator with tool name                      │
│   • Parse function call arguments                                           │
│   • Validate tool exists and arguments match schema                         │
│   • Begin tool execution via Amplifier coordinator.call_tool()              │
│   • Start execution timer                                                   │
│                                                                             │
│ ACTIONS ON EXIT:                                                            │
│   • Format tool result for OpenAI (conversation.item.create)                │
│   • Submit result (response.create to continue)                             │
│   • Log execution time and result size                                      │
│   • Update UI: Clear tool indicator                                         │
│                                                                             │
│ TOOL RESULT FORMAT:                                                         │
│   {                                                                         │
│     "type": "conversation.item.create",                                     │
│     "item": {                                                               │
│       "type": "function_call_output",                                       │
│       "call_id": "<from function_call>",                                    │
│       "output": "<JSON string result>"                                      │
│     }                                                                       │
│   }                                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.6 WAITING_AMPLIFIER

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STATE: WAITING_AMPLIFIER                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ENTRY CONDITIONS:                                                           │
│   • `task` tool invoked (delegates to Amplifier agent)                      │
│   • Long-running operation initiated                                        │
│   • Explicit agent delegation requested                                     │
│                                                                             │
│ EXIT TRANSITIONS:                                                           │
│   ┌────────────────────────────┬─────────────────┬────────────────────────┐ │
│   │ Trigger                    │ Target State    │ Condition              │ │
│   ├────────────────────────────┼─────────────────┼────────────────────────┤ │
│   │ agent_task_complete        │ PROCESSING      │ Result ready           │ │
│   │ agent_task_error           │ ERROR           │ Agent failed           │ │
│   │ speech_started             │ [queued]        │ Queue user input       │ │
│   │ user_cancel                │ IDLE            │ User aborts task       │ │
│   │ session.error              │ ERROR           │ Session failure        │ │
│   │ task_timeout               │ ERROR           │ 5min limit exceeded    │ │
│   └────────────────────────────┴─────────────────┴────────────────────────┘ │
│                                                                             │
│ TIMEOUT BEHAVIOR:                                                           │
│   • 5 minute maximum task duration → ERROR with partial result              │
│   • Progress updates expected every 30s (agent heartbeat)                   │
│   • No heartbeat for 60s → WARNING, continue waiting                        │
│   • Session timeout (15min) handled separately                              │
│                                                                             │
│ ACTIONS ON ENTRY:                                                           │
│   • Update UI: "Working on it..." with progress indicator                   │
│   • Spawn Amplifier agent task asynchronously                               │
│   • Subscribe to agent progress events                                      │
│   • Start task timer                                                        │
│   • Optionally: Play brief "working" audio cue                              │
│                                                                             │
│ ACTIONS ON EXIT:                                                            │
│   • Collect agent result/summary                                            │
│   • Truncate result if too large (>4000 chars → summarize)                  │
│   • Format as tool output for OpenAI                                        │
│   • Process any queued user input                                           │
│   • Log task duration and outcome                                           │
│                                                                             │
│ PROGRESS HANDLING:                                                          │
│   • Agent emits progress: Update UI with status                             │
│   • Long tasks: Periodic "still working" audio feedback                     │
│   • User can speak: Input queued, not processed until complete              │
│                                                                             │
│ UI FEEDBACK DURING WAIT:                                                    │
│   0-5s:   "Working on that..."                                              │
│   5-15s:  "Still working, this might take a moment..."                      │
│   15-30s: "Making progress..." + progress details if available              │
│   30s+:   "This is taking longer than expected..."                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.7 ERROR

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STATE: ERROR                                                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ENTRY CONDITIONS:                                                           │
│   • Any unhandled exception in state handlers                               │
│   • API error from OpenAI (rate limit, server error)                        │
│   • Tool execution failure                                                  │
│   • WebRTC connection degraded (not lost)                                   │
│   • Invalid state transition attempted                                      │
│                                                                             │
│ EXIT TRANSITIONS:                                                           │
│   ┌────────────────────────────┬─────────────────┬────────────────────────┐ │
│   │ Trigger                    │ Target State    │ Condition              │ │
│   ├────────────────────────────┼─────────────────┼────────────────────────┤ │
│   │ error_recovered            │ IDLE            │ Recovery successful    │ │
│   │ retry_succeeded            │ [previous]      │ Retry worked           │ │
│   │ connection_lost            │ RECONNECTING    │ Need full reconnect    │ │
│   │ unrecoverable              │ IDLE (notify)   │ Cannot continue        │ │
│   │ user_dismiss               │ IDLE            │ User acknowledges      │ │
│   └────────────────────────────┴─────────────────┴────────────────────────┘ │
│                                                                             │
│ TIMEOUT BEHAVIOR:                                                           │
│   • 10s in ERROR state → Auto-dismiss, attempt recovery                     │
│   • 3 retries max for retryable errors                                      │
│   • Exponential backoff: 1s, 2s, 4s between retries                         │
│                                                                             │
│ ACTIONS ON ENTRY:                                                           │
│   • Log error with full context and stack trace                             │
│   • Classify error type (see Error Classification below)                    │
│   • Update UI: Error indicator with user-friendly message                   │
│   • Stop any in-progress audio playback                                     │
│   • Cancel pending operations                                               │
│   • Determine recovery strategy                                             │
│                                                                             │
│ ACTIONS ON EXIT:                                                            │
│   • Clear error state                                                       │
│   • Reset retry counter if successful                                       │
│   • Log recovery outcome                                                    │
│   • Update UI: Clear error indicator                                        │
│                                                                             │
│ ERROR CLASSIFICATION:                                                       │
│   ┌───────────────────┬─────────────────┬─────────────────────────────────┐ │
│   │ Error Type        │ Recoverable?    │ Action                          │ │
│   ├───────────────────┼─────────────────┼─────────────────────────────────┤ │
│   │ RATE_LIMIT        │ Yes (retry)     │ Wait and retry                  │ │
│   │ NETWORK_TIMEOUT   │ Yes (retry)     │ Retry with backoff              │ │
│   │ TOOL_ERROR        │ Yes             │ Return error to LLM             │ │
│   │ INVALID_ARGS      │ Yes             │ Return error to LLM             │ │
│   │ SESSION_EXPIRED   │ Yes (reconnect) │ → RECONNECTING                  │ │
│   │ AUTH_FAILURE      │ No              │ Notify user, end session        │ │
│   │ SERVER_ERROR      │ Maybe           │ Retry once, then notify         │ │
│   │ UNKNOWN           │ No              │ Log, notify, recover to IDLE    │ │
│   └───────────────────┴─────────────────┴─────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.8 RECONNECTING

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STATE: RECONNECTING                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ ENTRY CONDITIONS:                                                           │
│   • WebRTC connection lost (ICE failure, network change)                    │
│   • Session timeout (15 minute limit reached)                               │
│   • Explicit reconnection requested                                         │
│   • Server-side disconnect detected                                         │
│                                                                             │
│ EXIT TRANSITIONS:                                                           │
│   ┌────────────────────────────┬─────────────────┬────────────────────────┐ │
│   │ Trigger                    │ Target State    │ Condition              │ │
│   ├────────────────────────────┼─────────────────┼────────────────────────┤ │
│   │ reconnect_success          │ IDLE            │ New session ready      │ │
│   │ reconnect_failed           │ ERROR           │ All retries exhausted  │ │
│   │ user_cancel                │ IDLE (ended)    │ User gives up          │ │
│   └────────────────────────────┴─────────────────┴────────────────────────┘ │
│                                                                             │
│ TIMEOUT BEHAVIOR:                                                           │
│   • 30s maximum reconnection attempt                                        │
│   • 3 retry attempts with exponential backoff                               │
│   • Backoff: 1s, 3s, 10s                                                    │
│   • Total max wait: ~45s before giving up                                   │
│                                                                             │
│ ACTIONS ON ENTRY:                                                           │
│   • Update UI: "Reconnecting..." indicator                                  │
│   • Save current conversation context/summary                               │
│   • Close existing WebRTC connection gracefully                             │
│   • Request new session from backend                                        │
│   • Begin reconnection timer                                                │
│                                                                             │
│ ACTIONS ON EXIT:                                                            │
│   • If successful:                                                          │
│     - Restore conversation context to new session                           │
│     - Update UI: "Reconnected" confirmation                                 │
│     - Play brief audio cue                                                  │
│   • If failed:                                                              │
│     - Log failure reason                                                    │
│     - Preserve conversation transcript locally                              │
│     - Offer manual retry option                                             │
│                                                                             │
│ CONTEXT PRESERVATION:                                                       │
│   • Save before disconnect:                                                 │
│     - Last N conversation turns (summarized)                                │
│     - Active file context                                                   │
│     - User preferences                                                      │
│     - Pending tool results                                                  │
│   • Restore after reconnect:                                                │
│     - Inject context summary as system message                              │
│     - Resume any interrupted operations                                     │
│                                                                             │
│ RECONNECTION SEQUENCE:                                                      │
│   1. GET /session (new session, same config)                                │
│   2. POST /sdp (new WebRTC connection)                                      │
│   3. session.update (restore context)                                       │
│   4. Verify audio path working                                              │
│   5. Transition to IDLE                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Transition Matrix

### Valid State Transitions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     STATE TRANSITION MATRIX                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ FROM \ TO        │ IDLE │ LIST │ PROC │ SPEK │ TOOL │ WAIT │ ERR  │ RECON │
│ ─────────────────┼──────┼──────┼──────┼──────┼──────┼──────┼──────┼───────│
│ IDLE             │  -   │  ✓   │  -   │  -   │  -   │  -   │  ✓   │  ✓    │
│ LISTENING        │  -   │  -   │  ✓   │  -   │  -   │  -   │  ✓   │  ✓    │
│ PROCESSING       │  ✓   │  ✓   │  -   │  ✓   │  ✓   │  -   │  ✓   │  ✓    │
│ SPEAKING         │  ✓   │  ✓   │  -   │  -   │  ✓   │  -   │  ✓   │  ✓    │
│ TOOL_EXECUTING   │  -   │  -   │  ✓   │  -   │  -   │  ✓   │  ✓   │  ✓    │
│ WAITING_AMPLIFIER│  ✓   │  -   │  ✓   │  -   │  -   │  -   │  ✓   │  ✓    │
│ ERROR            │  ✓   │  -   │  -   │  -   │  -   │  -   │  -   │  ✓    │
│ RECONNECTING     │  ✓   │  -   │  -   │  -   │  -   │  -   │  ✓   │  -    │
│                                                                             │
│ Legend: ✓ = valid transition, - = invalid transition                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Transition Events

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EVENT → TRANSITION MAPPING                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ OpenAI Events (Data Channel):                                               │
│   input_audio_buffer.speech_started  → IDLE/SPEAKING → LISTENING            │
│   input_audio_buffer.speech_stopped  → LISTENING → PROCESSING               │
│   response.created                   → [internal tracking]                  │
│   response.audio.delta               → PROCESSING → SPEAKING                │
│   response.audio.done                → SPEAKING → IDLE                      │
│   response.output_item.done          → PROCESSING → TOOL_EXECUTING          │
│   response.done                      → [cleanup, metrics]                   │
│   session.error                      → ANY → ERROR                          │
│                                                                             │
│ Client Events:                                                              │
│   push_to_talk_press                 → IDLE → LISTENING                     │
│   push_to_talk_release               → LISTENING → PROCESSING               │
│   user_cancel                        → WAITING_AMPLIFIER → IDLE             │
│   user_end_session                   → ANY → [terminated]                   │
│                                                                             │
│ Backend Events:                                                             │
│   tool_result_ready                  → TOOL_EXECUTING → PROCESSING          │
│   agent_task_complete                → WAITING_AMPLIFIER → PROCESSING       │
│   agent_task_error                   → WAITING_AMPLIFIER → ERROR            │
│                                                                             │
│ System Events:                                                              │
│   connection_lost                    → ANY → RECONNECTING                   │
│   session_timeout                    → ANY → RECONNECTING                   │
│   reconnect_success                  → RECONNECTING → IDLE                  │
│   error_recovered                    → ERROR → IDLE                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Error Recovery Flows

### Tool Execution Failure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     TOOL FAILURE RECOVERY                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TOOL_EXECUTING                                                            │
│        │                                                                    │
│        │ tool throws exception                                              │
│        ▼                                                                    │
│   ┌─────────────────┐                                                       │
│   │ Catch exception │                                                       │
│   └────────┬────────┘                                                       │
│            │                                                                │
│            ▼                                                                │
│   ┌─────────────────────────────────────────────────────────────┐          │
│   │ Format error as tool result:                                │          │
│   │ {                                                           │          │
│   │   "type": "function_call_output",                           │          │
│   │   "call_id": "...",                                         │          │
│   │   "output": "{\"error\": \"Tool failed: <message>\"}"       │          │
│   │ }                                                           │          │
│   └────────┬────────────────────────────────────────────────────┘          │
│            │                                                                │
│            ▼                                                                │
│   ┌─────────────────┐                                                       │
│   │   PROCESSING    │ (LLM handles error gracefully)                        │
│   └────────┬────────┘                                                       │
│            │                                                                │
│            ▼                                                                │
│   ┌─────────────────┐                                                       │
│   │    SPEAKING     │ "I encountered an issue with that..."                 │
│   └─────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Session Timeout Recovery

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   SESSION TIMEOUT RECOVERY                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ANY STATE (14:30 into session)                                            │
│        │                                                                    │
│        │ 30s warning: session.timeout_warning                               │
│        ▼                                                                    │
│   ┌─────────────────────────────────────────────────────────────┐          │
│   │ Actions:                                                    │          │
│   │ 1. Summarize conversation (last 10 turns)                   │          │
│   │ 2. Note active files/context                                │          │
│   │ 3. Save to local storage                                    │          │
│   └────────┬────────────────────────────────────────────────────┘          │
│            │                                                                │
│            │ session.closed (15:00)                                         │
│            ▼                                                                │
│   ┌─────────────────┐                                                       │
│   │  RECONNECTING   │                                                       │
│   └────────┬────────┘                                                       │
│            │                                                                │
│   ┌────────┴────────┐                                                       │
│   │                 │                                                       │
│   ▼                 ▼                                                       │
│ ┌──────────┐    ┌──────────────────────────────────────────┐               │
│ │  Create  │    │ Inject context:                          │               │
│ │ session  │───►│ "Continuing conversation. Summary: ..."  │               │
│ └──────────┘    └──────────────────────────────────────────┘               │
│                      │                                                      │
│                      ▼                                                      │
│                 ┌──────────┐                                                │
│                 │   IDLE   │ (session restored)                             │
│                 └──────────┘                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Network Interruption Recovery

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  NETWORK INTERRUPTION RECOVERY                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   SPEAKING/LISTENING                                                        │
│        │                                                                    │
│        │ WebRTC: iceConnectionState = "disconnected"                        │
│        ▼                                                                    │
│   ┌─────────────────────────────────────────────────────────────┐          │
│   │ Wait 2s for ICE recovery (automatic)                        │          │
│   └────────┬────────────────────────────────────────────────────┘          │
│            │                                                                │
│   ┌────────┴────────┐                                                       │
│   │                 │                                                       │
│   ▼                 ▼                                                       │
│ ┌──────────────┐  ┌──────────────┐                                         │
│ │ ICE recovered│  │ ICE failed   │                                         │
│ │ (continue)   │  │              │                                         │
│ └──────────────┘  └──────┬───────┘                                         │
│                          │                                                  │
│                          ▼                                                  │
│                    ┌─────────────┐                                          │
│                    │RECONNECTING │                                          │
│                    └──────┬──────┘                                          │
│                           │                                                 │
│           ┌───────────────┼───────────────┐                                │
│           │               │               │                                │
│           ▼               ▼               ▼                                │
│     ┌──────────┐    ┌──────────┐    ┌──────────┐                          │
│     │ Attempt 1│    │ Attempt 2│    │ Attempt 3│                          │
│     │  (1s)    │───►│  (3s)    │───►│  (10s)   │                          │
│     └──────────┘    └──────────┘    └──────┬───┘                          │
│           │               │               │                                │
│           ▼               ▼               ▼                                │
│     ┌──────────┐    ┌──────────┐    ┌──────────┐                          │
│     │ Success? │    │ Success? │    │ Success? │                          │
│     └────┬─────┘    └────┬─────┘    └────┬─────┘                          │
│          │               │               │                                 │
│    yes   │         yes   │         yes   │   no                           │
│    ┌─────┴───────────────┴───────────────┤   │                            │
│    │                                     │   │                            │
│    ▼                                     ▼   ▼                            │
│ ┌──────────┐                       ┌──────────────┐                       │
│ │   IDLE   │                       │    ERROR     │                       │
│ │(restored)│                       │ (show retry) │                       │
│ └──────────┘                       └──────────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Implementation Considerations

### State Machine Interface

```typescript
interface ConversationStateMachine {
  // Current state
  readonly state: ConversationState;
  readonly previousState: ConversationState | null;
  readonly stateEnteredAt: number;
  
  // State data
  readonly context: StateContext;
  
  // Transitions
  transition(event: StateEvent): void;
  canTransition(event: StateEvent): boolean;
  
  // Lifecycle
  onStateEnter(state: ConversationState, handler: StateHandler): void;
  onStateExit(state: ConversationState, handler: StateHandler): void;
  onTransition(handler: TransitionHandler): void;
  
  // Error handling
  onError(handler: ErrorHandler): void;
  recover(): void;
}

type ConversationState = 
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'tool_executing'
  | 'waiting_amplifier'
  | 'error'
  | 'reconnecting';

interface StateContext {
  // Session info
  sessionId: string;
  sessionStartTime: number;
  
  // Audio tracking
  currentAudioItemId: string | null;
  audioPlaybackStartTime: number | null;
  audioBytesPlayed: number;
  
  // Tool tracking
  pendingToolCall: ToolCall | null;
  toolExecutionStartTime: number | null;
  
  // Error tracking
  lastError: Error | null;
  retryCount: number;
  
  // Context preservation
  conversationSummary: string;
  activeFiles: string[];
  queuedUserInput: AudioBuffer | null;
}
```

### Timeout Configuration

```typescript
const STATE_TIMEOUTS: Record<ConversationState, number | null> = {
  idle: null,                    // No timeout
  listening: 30_000,             // 30s max speech
  processing: 30_000,            // 30s LLM timeout
  speaking: 120_000,             // 2min max (warning only)
  tool_executing: 30_000,        // 30s tool timeout
  waiting_amplifier: 300_000,    // 5min agent timeout
  error: 10_000,                 // 10s auto-dismiss
  reconnecting: 30_000,          // 30s reconnect timeout
};

const RETRY_CONFIG = {
  maxRetries: 3,
  backoffMs: [1000, 2000, 4000],  // Exponential backoff
  retryableErrors: [
    'RATE_LIMIT',
    'NETWORK_TIMEOUT',
    'SERVER_ERROR',
  ],
};
```

### Event Bus Integration

```typescript
// State machine events for UI/logging
interface StateMachineEvents {
  'state:enter': { state: ConversationState; context: StateContext };
  'state:exit': { state: ConversationState; duration: number };
  'transition': { from: ConversationState; to: ConversationState; event: StateEvent };
  'timeout': { state: ConversationState; duration: number };
  'error': { state: ConversationState; error: Error };
  'recovery': { from: ConversationState; success: boolean };
}
```

### Debug Visualization

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     STATE MACHINE DEBUG VIEW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Current: SPEAKING                     Session: 4m 32s                     │
│   Previous: PROCESSING (245ms)          Turns: 7                            │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │ Timeline:                                                           │   │
│   │                                                                     │   │
│   │ IDLE ──► LISTENING ──► PROCESSING ──► SPEAKING ──► IDLE ──►        │   │
│   │ (2.1s)   (3.4s)        (0.8s)         (12.3s)      (1.2s)          │   │
│   │                                                                     │   │
│   │ LISTENING ──► PROCESSING ──► TOOL_EXECUTING ──► PROCESSING ──►     │   │
│   │ (2.8s)        (0.3s)         (1.2s)              (0.4s)            │   │
│   │                                                                     │   │
│   │ SPEAKING ◄── (current, 8.2s elapsed)                               │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   Metrics:                                                                  │
│   • Avg time-to-first-audio: 623ms                                         │
│   • Interruption rate: 14%                                                  │
│   • Tool calls: 3 (100% success)                                           │
│   • Errors: 0                                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

This state machine provides:

1. **Clear boundaries** - Each state has well-defined entry/exit conditions
2. **Predictable behavior** - All transitions are explicitly mapped
3. **Graceful degradation** - Every state can transition to ERROR or RECONNECTING
4. **User experience** - Appropriate timeouts and feedback for each state
5. **Debuggability** - Comprehensive logging and visualization support

The machine handles the complex interplay between:
- User speech (VAD-triggered)
- LLM processing (async)
- Audio playback (streaming)
- Tool execution (sync/async)
- Network conditions (unreliable)
- Session limits (15 minutes)

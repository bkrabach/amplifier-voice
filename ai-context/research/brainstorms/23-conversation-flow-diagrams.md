# Conversation Flow Diagrams

> **Date**: 2026-01-31
> **Status**: Reference Documentation
> **Purpose**: Visual conversation flows showing interactions between User, Voice Model, Server, and Amplifier

---

## Table of Contents

1. [Component Legend](#1-component-legend)
2. [Happy Path: Simple Query → Response](#2-happy-path-simple-query--response)
3. [Tool Execution Flow](#3-tool-execution-flow)
4. [Amplifier Delegation Flow](#4-amplifier-delegation-flow)
5. [Error Recovery Flow](#5-error-recovery-flow)
6. [Session Timeout and Reconnection](#6-session-timeout-and-reconnection)
7. [Multi-Turn Conversation with Context](#7-multi-turn-conversation-with-context)
8. [Flow Comparison Summary](#8-flow-comparison-summary)

---

## 1. Component Legend

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM COMPONENTS                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────────┐   │
│   │  USER   │     │   VOICE     │     │   VOICE     │     │    AMPLIFIER    │   │
│   │         │     │   MODEL     │     │   SERVER    │     │                 │   │
│   │ Browser │     │  (OpenAI    │     │  (FastAPI)  │     │  (Agent/Tools)  │   │
│   │ + Mic   │     │  Realtime)  │     │             │     │                 │   │
│   └─────────┘     └─────────────┘     └─────────────┘     └─────────────────┘   │
│       │                 │                   │                     │             │
│       │    WebRTC       │      REST API     │      Python SDK     │             │
│       │◄───────────────►│◄─────────────────►│◄───────────────────►│             │
│       │   Audio/Data    │    Tool Calls     │    Task Execution   │             │
│                                                                                  │
│   Line Types:                                                                    │
│   ─────►  Synchronous call / request                                            │
│   ─ ─ ─►  Asynchronous / streaming                                              │
│   ═════►  Audio stream                                                          │
│   ◄────►  Bidirectional                                                         │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Role | Key Functions |
|-----------|------|---------------|
| **User** | Human with browser | Speaks, listens, sees UI |
| **Voice Model** | OpenAI Realtime API | STT, LLM reasoning, TTS |
| **Voice Server** | Our FastAPI server | Session management, tool routing |
| **Amplifier** | Agent framework | Complex task execution |

---

## 2. Happy Path: Simple Query → Response

### 2.1 Overview

The simplest flow: user asks a question, voice model responds directly without tools.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    HAPPY PATH: SIMPLE QUERY → RESPONSE                          │
│                         Total Time: ~600-800ms                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │  "What time is it?"│                    │                   │              │
│     │═══════════════════►│                    │                   │              │
│     │    (audio stream)  │                    │                   │              │
│     │                    │                    │                   │              │
│     │         ┌──────────┴──────────┐        │                   │              │
│     │         │  1. VAD detects     │        │                   │              │
│     │         │     speech end      │        │                   │              │
│     │         │  2. STT transcribes │        │                   │              │
│     │         │  3. LLM generates   │        │                   │              │
│     │         │     response        │        │                   │              │
│     │         │  4. TTS synthesizes │        │                   │              │
│     │         └──────────┬──────────┘        │                   │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "It's 2:30 PM"    │                    │                   │              │
│     │   (audio stream)   │                    │                   │              │
│     │                    │                    │                   │              │
│                                                                                  │
│   Timeline:                                                                      │
│   0ms        200ms       400ms       600ms       800ms                           │
│   │──────────│──────────│──────────│──────────│                                  │
│   User       VAD        LLM        TTS        Audio                              │
│   speaks     detects    processes  starts     plays                              │
│              silence                                                             │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Detailed Sequence

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DETAILED HAPPY PATH SEQUENCE                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER                              VOICE MODEL                                 │
│     │                                     │                                      │
│     │ ══════ Audio packets (Opus) ══════► │                                      │
│     │                                     │                                      │
│     │                        input_audio_buffer.speech_started                   │
│     │                                     │────┐                                 │
│     │                                     │    │ VAD: speech detected            │
│     │                                     │◄───┘                                 │
│     │                                     │                                      │
│     │ ══════ More audio ════════════════► │                                      │
│     │                                     │                                      │
│     │                        input_audio_buffer.speech_stopped                   │
│     │                                     │────┐                                 │
│     │                                     │    │ VAD: silence detected           │
│     │                                     │◄───┘                                 │
│     │                                     │                                      │
│     │                        input_audio_buffer.committed                        │
│     │                                     │────┐                                 │
│     │                                     │    │ Audio committed to context      │
│     │                                     │◄───┘                                 │
│     │                                     │                                      │
│     │                conversation.item.created (user message)                    │
│     │◄─────────────────────────────────── │                                      │
│     │                                     │                                      │
│     │                        response.created                                    │
│     │◄─────────────────────────────────── │                                      │
│     │                                     │                                      │
│     │                        response.output_item.added                          │
│     │◄─────────────────────────────────── │                                      │
│     │                                     │                                      │
│     │                        response.audio_transcript.delta                     │
│     │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │ (streaming text)                     │
│     │                                     │                                      │
│     │ ◄════ Audio packets (response) ════ │                                      │
│     │                        response.audio.delta (streaming audio)              │
│     │                                     │                                      │
│     │                        response.audio.done                                 │
│     │◄─────────────────────────────────── │                                      │
│     │                                     │                                      │
│     │                        response.done                                       │
│     │◄─────────────────────────────────── │                                      │
│     │                                     │                                      │
│     ▼                                     ▼                                      │
│   [Idle]                              [Idle]                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 State Transitions

```
┌────────────┐  speech_started  ┌─────────────┐  speech_stopped  ┌────────────┐
│    IDLE    │─────────────────►│  LISTENING  │─────────────────►│ PROCESSING │
└────────────┘                  └─────────────┘                  └─────┬──────┘
      ▲                                                                │
      │                          audio.done                   audio.delta
      └────────────────────────────────────┬──────────────────────────┘
                                           │
                                    ┌──────▼──────┐
                                    │  SPEAKING   │
                                    └─────────────┘
```

---

## 3. Tool Execution Flow

### 3.1 Fast Tool (Direct Execution)

Tools like `web_search`, `read_file` that execute quickly.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    TOOL EXECUTION: FAST TOOL (web_search)                       │
│                         Total Time: ~2-5 seconds                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │ "Search for Python │                    │                   │              │
│     │  async patterns"   │                    │                   │              │
│     │═══════════════════►│                    │                   │              │
│     │                    │                    │                   │              │
│     │          ┌─────────┴─────────┐         │                   │              │
│     │          │ LLM decides to    │         │                   │              │
│     │          │ call web_search   │         │                   │              │
│     │          └─────────┬─────────┘         │                   │              │
│     │                    │                    │                   │              │
│     │                    │  function_call     │                   │              │
│     │                    │  {web_search:      │                   │              │
│     │                    │   "Python async"}  │                   │              │
│     │                    │───────────────────►│                   │              │
│     │                    │                    │                   │              │
│     │          "Let me search for that..."   │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │    (interim audio) │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │                    │  web_search()     │              │
│     │                    │                    │──────────────────►│              │
│     │                    │                    │                   │              │
│     │                    │                    │   ┌───────────────┴───┐          │
│     │                    │                    │   │ Execute search    │          │
│     │                    │                    │   │ (1-3 seconds)     │          │
│     │                    │                    │   └───────────────┬───┘          │
│     │                    │                    │                   │              │
│     │                    │                    │◄──────────────────│              │
│     │                    │                    │   {results: [...]}│              │
│     │                    │                    │                   │              │
│     │                    │  function_result   │                   │              │
│     │                    │◄───────────────────│                   │              │
│     │                    │                    │                   │              │
│     │          ┌─────────┴─────────┐         │                   │              │
│     │          │ LLM summarizes    │         │                   │              │
│     │          │ results for voice │         │                   │              │
│     │          └─────────┬─────────┘         │                   │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "I found several  │                    │                   │              │
│     │   patterns..."     │                    │                   │              │
│     │                    │                    │                   │              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Tool Chain (Multiple Tools)

When the model needs multiple tools to complete a request.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    TOOL CHAIN: MULTIPLE SEQUENTIAL TOOLS                        │
│                         "Read config.py and explain it"                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │═══════════════════►│                    │                   │              │
│     │ "Read config.py    │                    │                   │              │
│     │  and explain"      │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │───────────────────►│                   │              │
│     │                    │  glob("**/config.py")                  │              │
│     │                    │                    │──────────────────►│              │
│     │                    │                    │◄──────────────────│              │
│     │                    │◄───────────────────│  ["src/config.py"]│              │
│     │                    │                    │                   │              │
│     │                    │───────────────────►│                   │              │
│     │                    │  read_file("src/config.py")            │              │
│     │                    │                    │──────────────────►│              │
│     │                    │                    │◄──────────────────│              │
│     │                    │◄───────────────────│  {content: "..."} │              │
│     │                    │                    │                   │              │
│     │          ┌─────────┴─────────┐         │                   │              │
│     │          │ LLM analyzes and  │         │                   │              │
│     │          │ explains content  │         │                   │              │
│     │          └─────────┬─────────┘         │                   │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "This config file │                    │                   │              │
│     │   defines..."      │                    │                   │              │
│     │                    │                    │                   │              │
│                                                                                  │
│   Tool Execution Timeline:                                                       │
│   ┌────────┬────────┬────────┬────────┬────────┬────────┐                       │
│   │ Audio  │  glob  │  wait  │  read  │  LLM   │ Audio  │                       │
│   │  in    │  tool  │        │  file  │process │  out   │                       │
│   └────────┴────────┴────────┴────────┴────────┴────────┘                       │
│   0s       1s       2s       3s       4s       5s                                │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Tool with User Feedback (Progress Updates)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    TOOL WITH PROGRESS FEEDBACK                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │═══════════════════►│                    │                   │              │
│     │  "Run the tests"   │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │───────────────────►│                   │              │
│     │                    │  bash("pytest")    │                   │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "Running tests,   │                    │                   │              │
│     │   this may take    │                    │──────────────────►│              │
│     │   a moment..."     │                    │  bash("pytest")   │              │
│     │                    │                    │                   │              │
│     │                    │  progress_update   │                   │              │
│     │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─│◄─ ─ ─ ─ ─ ─ ─ ─ ─ │◄ ─ ─ ─ ─ ─ ─ ─ ─ │              │
│     │  (UI: "12/50       │  {progress: 24%}  │                   │              │
│     │   tests passed")   │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │  progress_update   │                   │              │
│     │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─│◄─ ─ ─ ─ ─ ─ ─ ─ ─ │◄ ─ ─ ─ ─ ─ ─ ─ ─ │              │
│     │  (UI: "48/50       │  {progress: 96%}  │                   │              │
│     │   tests passed")   │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │◄───────────────────│◄──────────────────│              │
│     │                    │  {result: "pass"}  │  test complete    │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "All 50 tests     │                    │                   │              │
│     │   passed!"         │                    │                   │              │
│     │                    │                    │                   │              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Amplifier Delegation Flow

### 4.1 Simple Task Delegation

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    AMPLIFIER DELEGATION: SIMPLE TASK                            │
│                    "Add logging to the auth module"                             │
│                         Total Time: ~30-60 seconds                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │═══════════════════►│                    │                   │              │
│     │ "Add logging to    │                    │                   │              │
│     │  the auth module"  │                    │                   │              │
│     │                    │                    │                   │              │
│     │          ┌─────────┴─────────┐         │                   │              │
│     │          │ LLM decides this  │         │                   │              │
│     │          │ needs Amplifier   │         │                   │              │
│     │          └─────────┬─────────┘         │                   │              │
│     │                    │                    │                   │              │
│     │                    │───────────────────►│                   │              │
│     │                    │  task({           │                   │              │
│     │                    │    description:    │                   │              │
│     │                    │    "Add logging",  │                   │              │
│     │                    │    agent: "coder"  │                   │              │
│     │                    │  })                │                   │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "I'll delegate    │                    │                   │              │
│     │   this to the      │                    │                   │              │
│     │   coding agent..." │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │                    │──────────────────►│              │
│     │                    │                    │ spawn_agent(      │              │
│     │                    │                    │   "coder",        │              │
│     │                    │                    │   task_context)   │              │
│     │                    │                    │                   │              │
│     │                    │                    │    ┌──────────────┴──────────┐   │
│     │                    │                    │    │  AMPLIFIER AGENT        │   │
│     │                    │                    │    │  ==================     │   │
│     │                    │                    │    │  1. Read auth module    │   │
│     │                    │                    │    │  2. Analyze structure   │   │
│     │                    │                    │    │  3. Add import logging  │   │
│     │                    │                    │    │  4. Add log statements  │   │
│     │                    │                    │    │  5. Run tests           │   │
│     │                    │                    │    │  6. Summarize changes   │   │
│     │                    │                    │    └──────────────┬──────────┘   │
│     │                    │                    │                   │              │
│     │                    │  status_update     │                   │              │
│     │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─│◄─ ─ ─ ─ ─ ─ ─ ─ ─ │◄ ─ ─ ─ ─ ─ ─ ─ ─ │              │
│     │  (UI: "Reading     │  {step: "reading"}│                   │              │
│     │   auth module...")  │                   │                   │              │
│     │                    │                    │                   │              │
│     │                    │  status_update     │                   │              │
│     │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─│◄─ ─ ─ ─ ─ ─ ─ ─ ─ │◄ ─ ─ ─ ─ ─ ─ ─ ─ │              │
│     │  (UI: "Adding      │  {step: "editing"}│                   │              │
│     │   log statements") │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │◄───────────────────│◄──────────────────│              │
│     │                    │  task_complete     │  {summary: "...", │              │
│     │                    │                    │   files_changed:  │              │
│     │                    │                    │   ["auth.py"]}    │              │
│     │                    │                    │                   │              │
│     │          ┌─────────┴─────────┐         │                   │              │
│     │          │ LLM summarizes    │         │                   │              │
│     │          │ for voice output  │         │                   │              │
│     │          └─────────┬─────────┘         │                   │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "Done! I added    │                    │                   │              │
│     │   logging to 3     │                    │                   │              │
│     │   functions..."    │                    │                   │              │
│     │                    │                    │                   │              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Complex Multi-Agent Delegation

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    AMPLIFIER DELEGATION: MULTI-AGENT FLOW                       │
│                    "Implement user authentication feature"                      │
│                         Total Time: ~2-10 minutes                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │═══════════════════►│                    │                   │              │
│     │ "Implement user    │                    │                   │              │
│     │  authentication"   │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │───────────────────►│                   │              │
│     │                    │  task("implement   │                   │              │
│     │                    │   auth feature")   │                   │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "This is a big    │                    │                   │              │
│     │   task. I'll       │                    │                   │              │
│     │   coordinate..."   │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │                    │──────────────────►│              │
│     │                    │                    │                   │              │
│     │                    │                    │    ┌──────────────┴──────────┐   │
│     │                    │                    │    │  ORCHESTRATOR AGENT     │   │
│     │                    │                    │    │  =====================  │   │
│     │                    │                    │    │                         │   │
│     │                    │                    │    │  ┌─────────────────┐    │   │
│     │                    │                    │    │  │ PLANNER AGENT   │    │   │
│     │                    │                    │    │  │ → Create spec   │    │   │
│     │                    │                    │    │  │ → Define API    │    │   │
│     │                    │                    │    │  └────────┬────────┘    │   │
│     │                    │                    │    │           │             │   │
│     │                    │  status_update     │    │           ▼             │   │
│     │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─│◄─ ─ ─ ─ ─ ─ ─ ─ ─ │◄ ─ │  ┌─────────────────┐    │   │
│     │  (UI: "Planning    │  {agent: "planner"}│    │  │ CODER AGENT     │    │   │
│     │   phase...")       │                    │    │  │ → Implement     │    │   │
│     │                    │                    │    │  │ → Write tests   │    │   │
│     │                    │                    │    │  └────────┬────────┘    │   │
│     │                    │                    │    │           │             │   │
│     │                    │  status_update     │    │           ▼             │   │
│     │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─│◄─ ─ ─ ─ ─ ─ ─ ─ ─ │◄ ─ │  ┌─────────────────┐    │   │
│     │  (UI: "Implementing│  {agent: "coder"} │    │  │ REVIEWER AGENT  │    │   │
│     │   auth logic...")  │                    │    │  │ → Code review   │    │   │
│     │                    │                    │    │  │ → Security check│    │   │
│     │                    │                    │    │  └────────┬────────┘    │   │
│     │                    │                    │    │           │             │   │
│     │                    │  status_update     │    │           ▼             │   │
│     │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─│◄─ ─ ─ ─ ─ ─ ─ ─ ─ │◄ ─ │  [COMPLETE]           │   │
│     │  (UI: "Review      │  {agent:"reviewer"}│    │                         │   │
│     │   complete")       │                    │    └──────────────┬──────────┘   │
│     │                    │                    │                   │              │
│     │                    │◄───────────────────│◄──────────────────│              │
│     │                    │  task_complete     │                   │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "Authentication   │                    │                   │              │
│     │   is implemented!  │                    │                   │              │
│     │   Created 3 files, │                    │                   │              │
│     │   12 tests pass."  │                    │                   │              │
│     │                    │                    │                   │              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Delegation with User Interaction

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    AMPLIFIER DELEGATION WITH CLARIFICATION                      │
│                    Agent needs user input mid-task                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │═══════════════════►│                    │                   │              │
│     │ "Create a new      │                    │                   │              │
│     │  API endpoint"     │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │───────────────────►│──────────────────►│              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "Working on it..."│                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │                    │    ┌──────────────┴──────────┐   │
│     │                    │                    │    │ Agent needs decision:   │   │
│     │                    │                    │    │ REST or GraphQL?        │   │
│     │                    │                    │    └──────────────┬──────────┘   │
│     │                    │                    │                   │              │
│     │                    │  clarification_needed                  │              │
│     │                    │◄───────────────────│◄──────────────────│              │
│     │                    │  {question: "REST  │                   │              │
│     │                    │   or GraphQL?"}    │                   │              │
│     │                    │                    │   [WAITING]       │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "Should I create  │                    │                   │              │
│     │   a REST or        │                    │                   │              │
│     │   GraphQL endpoint?"│                   │                   │              │
│     │                    │                    │                   │              │
│     │═══════════════════►│                    │                   │              │
│     │  "Use REST"        │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │───────────────────►│──────────────────►│              │
│     │                    │  clarification_    │  {answer: "REST"} │              │
│     │                    │  response          │                   │              │
│     │                    │                    │   [RESUMED]       │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "Got it, creating │                    │                   │              │
│     │   REST endpoint..."│                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │   ... continues ... │                   │              │
│     │                    │                    │                   │              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Error Recovery Flow

### 5.1 Tool Execution Error

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    ERROR RECOVERY: TOOL FAILURE                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │═══════════════════►│                    │                   │              │
│     │ "Read the config   │                    │                   │              │
│     │  from /secret/path"│                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │───────────────────►│                   │              │
│     │                    │  read_file(        │                   │              │
│     │                    │   "/secret/path")  │                   │              │
│     │                    │                    │──────────────────►│              │
│     │                    │                    │                   │              │
│     │                    │                    │    ┌──────────────┴──────────┐   │
│     │                    │                    │    │ ❌ Permission denied    │   │
│     │                    │                    │    │    EACCES error         │   │
│     │                    │                    │    └──────────────┬──────────┘   │
│     │                    │                    │                   │              │
│     │                    │◄───────────────────│◄──────────────────│              │
│     │                    │  function_error    │  {error:          │              │
│     │                    │                    │   "Permission     │              │
│     │                    │                    │   denied"}        │              │
│     │                    │                    │                   │              │
│     │          ┌─────────┴─────────┐         │                   │              │
│     │          │ LLM handles error │         │                   │              │
│     │          │ gracefully        │         │                   │              │
│     │          └─────────┬─────────┘         │                   │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "I can't access   │                    │                   │              │
│     │   that file - it   │                    │                   │              │
│     │   requires special │                    │                   │              │
│     │   permissions."    │                    │                   │              │
│     │                    │                    │                   │              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Amplifier Task Failure

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    ERROR RECOVERY: AMPLIFIER TASK FAILURE                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │═══════════════════►│                    │                   │              │
│     │ "Deploy to prod"   │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │───────────────────►│──────────────────►│              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "Starting deploy" │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │                    │    ┌──────────────┴──────────┐   │
│     │                    │                    │    │ Agent starts deploy...  │   │
│     │                    │                    │    │                         │   │
│     │                    │                    │    │ ❌ Tests failing!       │   │
│     │                    │                    │    │                         │   │
│     │                    │                    │    │ Recovery attempt 1:     │   │
│     │                    │                    │    │ → Fix obvious issue     │   │
│     │                    │                    │    │ → Rerun tests           │   │
│     │                    │                    │    │ ❌ Still failing        │   │
│     │                    │                    │    │                         │   │
│     │                    │                    │    │ Recovery attempt 2:     │   │
│     │                    │                    │    │ → Analyze failures      │   │
│     │                    │                    │    │ ❌ Needs user decision  │   │
│     │                    │                    │    └──────────────┬──────────┘   │
│     │                    │                    │                   │              │
│     │                    │◄───────────────────│◄──────────────────│              │
│     │                    │  task_failed       │  {error: "tests   │              │
│     │                    │                    │   failing",       │              │
│     │                    │                    │   details: "...", │              │
│     │                    │                    │   suggestions: []}│              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "Deploy failed    │                    │                   │              │
│     │   because 3 tests  │                    │                   │              │
│     │   are failing.     │                    │                   │              │
│     │   Should I fix     │                    │                   │              │
│     │   them first?"     │                    │                   │              │
│     │                    │                    │                   │              │
│     │═══════════════════►│                    │                   │              │
│     │  "Yes, fix them"   │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │───────────────────►│──────────────────►│              │
│     │                    │  task("fix tests   │                   │              │
│     │                    │   then deploy")    │  [NEW TASK]       │              │
│     │                    │                    │                   │              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Network/WebRTC Error

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    ERROR RECOVERY: NETWORK FAILURE                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │═══════════════════►│                    │                   │              │
│     │  (speaking...)     │                    │                   │              │
│     │                    │                    │                   │              │
│     │        ┌───────────┴───────────┐       │                   │              │
│     │        │  ❌ WebRTC connection │       │                   │              │
│     │        │     dropped           │       │                   │              │
│     │        └───────────┬───────────┘       │                   │              │
│     │                    │                    │                   │              │
│     │  ┌─────────────────┴─────────────────┐ │                   │              │
│     │  │  CLIENT DETECTS DISCONNECTION     │ │                   │              │
│     │  │  ================================ │ │                   │              │
│     │  │  1. ICE connection failed         │ │                   │              │
│     │  │  2. UI shows "Reconnecting..."    │ │                   │              │
│     │  │  3. Start reconnection timer      │ │                   │              │
│     │  └─────────────────┬─────────────────┘ │                   │              │
│     │                    │                    │                   │              │
│     │  [UI: 🔄 Reconnecting...]             │                   │              │
│     │                    │                    │                   │              │
│     │                    │   GET /session/    │                   │              │
│     │                    │   reconnect        │                   │              │
│     │                    │────────────────────►                   │              │
│     │                    │                    │                   │              │
│     │                    │   {ephemeral_key,  │                   │              │
│     │                    │    session_id}     │                   │              │
│     │                    │◄────────────────────                   │              │
│     │                    │                    │                   │              │
│     │        ┌───────────┴───────────┐       │                   │              │
│     │        │  New WebRTC connection│       │                   │              │
│     │        │  established          │       │                   │              │
│     │        └───────────┬───────────┘       │                   │              │
│     │                    │                    │                   │              │
│     │                    │ session.update     │                   │              │
│     │                    │ (restore context)  │                   │              │
│     │                    │────────────────────►                   │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "I'm back. Sorry  │                    │                   │              │
│     │   about that       │                    │                   │              │
│     │   interruption.    │                    │                   │              │
│     │   What were we     │                    │                   │              │
│     │   discussing?"     │                    │                   │              │
│     │                    │                    │                   │              │
│  [UI: ✅ Connected]      │                    │                   │              │
│     │                    │                    │                   │              │
│                                                                                  │
│   Recovery Timeline:                                                             │
│   ┌─────────┬─────────┬─────────┬─────────┬─────────┐                           │
│   │ Detect  │ Attempt │ Get new │ Connect │ Restore │                           │
│   │ failure │ reconnect│ key     │ WebRTC  │ context │                           │
│   └─────────┴─────────┴─────────┴─────────┴─────────┘                           │
│   0s        1s        2s        4s        5s                                     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Session Timeout and Reconnection

### 6.1 Idle Timeout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    SESSION TIMEOUT: IDLE DISCONNECT                             │
│                    15-minute inactivity timeout                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │   (last interaction 14 minutes ago)    │                   │              │
│     │                    │                    │                   │              │
│     │                    │                    │  ┌───────────────┐│              │
│     │                    │                    │  │Timeout check  ││              │
│     │                    │                    │  │every 1 min    ││              │
│     │                    │                    │  └───────┬───────┘│              │
│     │                    │                    │          │        │              │
│     │                    │                    │          ▼        │              │
│     │                    │   session.warning  │  14:30 elapsed    │              │
│     │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─│◄─ ─ ─ ─ ─ ─ ─ ─ ─ │                   │              │
│     │  (UI: "Session     │  {warning:        │                   │              │
│     │   expires in       │   "30s remaining"}│                   │              │
│     │   30 seconds")     │                    │                   │              │
│     │                    │                    │                   │              │
│     │   [User does not respond]              │                   │              │
│     │                    │                    │                   │              │
│     │                    │   session.expired  │  15:00 elapsed    │              │
│     │◄─ ─ ─ ─ ─ ─ ─ ─ ─ ─│◄─ ─ ─ ─ ─ ─ ─ ─ ─ │                   │              │
│     │  (UI: "Session     │                    │                   │              │
│     │   ended")          │                    │                   │              │
│     │                    │                    │                   │              │
│     │        ┌───────────┴───────────┐       │                   │              │
│     │        │ WebRTC disconnected   │       │                   │              │
│     │        │ cleanly               │       │                   │              │
│     │        └───────────────────────┘       │                   │              │
│     │                    │                    │                   │              │
│     │                    │                    │  ┌───────────────┐│              │
│     │                    │                    │  │Save session   ││              │
│     │                    │                    │  │context to DB  ││              │
│     │                    │                    │  │for potential  ││              │
│     │                    │                    │  │restoration    ││              │
│     │                    │                    │  └───────────────┘│              │
│     │                    │                    │                   │              │
│  [UI: "Click to         │                    │                   │              │
│   reconnect"]            │                    │                   │              │
│     │                    │                    │                   │              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Session Restoration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    SESSION RESTORATION AFTER TIMEOUT                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │  [Clicks "Reconnect"]                  │                   │              │
│     │                    │                    │                   │              │
│     │                    │  POST /session/    │                   │              │
│     │                    │  restore           │                   │              │
│     │                    │  {prev_session_id} │                   │              │
│     │                    │───────────────────►│                   │              │
│     │                    │                    │                   │              │
│     │                    │                    │  ┌───────────────┐│              │
│     │                    │                    │  │Load saved     ││              │
│     │                    │                    │  │session context││              │
│     │                    │                    │  │               ││              │
│     │                    │                    │  │• Conversation ││              │
│     │                    │                    │  │  history      ││              │
│     │                    │                    │  │• Pending tasks││              │
│     │                    │                    │  │• User prefs   ││              │
│     │                    │                    │  └───────┬───────┘│              │
│     │                    │                    │          │        │              │
│     │                    │  {new_session_id,  │          │        │              │
│     │                    │   ephemeral_key,   │◄─────────┘        │              │
│     │                    │   context_summary} │                   │              │
│     │                    │◄───────────────────│                   │              │
│     │                    │                    │                   │              │
│     │        ┌───────────┴───────────┐       │                   │              │
│     │        │ New WebRTC connection │       │                   │              │
│     │        │ + restored context    │       │                   │              │
│     │        └───────────┬───────────┘       │                   │              │
│     │                    │                    │                   │              │
│     │                    │  session.update    │                   │              │
│     │                    │  {instructions:    │                   │              │
│     │                    │   restored_context}│                   │              │
│     │                    │───────────────────►│                   │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "Welcome back!    │                    │                   │              │
│     │   We were working  │                    │                   │              │
│     │   on the auth      │                    │                   │              │
│     │   feature. Want    │                    │                   │              │
│     │   to continue?"    │                    │                   │              │
│     │                    │                    │                   │              │
│                                                                                  │
│   Restored Context Includes:                                                     │
│   ┌────────────────────────────────────────────────────────────────────────┐    │
│   │ • Last 10 conversation turns                                            │    │
│   │ • Active file context (files being discussed)                           │    │
│   │ • Pending Amplifier tasks (if any)                                      │    │
│   │ • User preferences (voice, verbosity)                                   │    │
│   │ • Current working directory                                             │    │
│   └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Mid-Task Reconnection

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    RECONNECTION DURING AMPLIFIER TASK                           │
│                    Connection lost while agent working                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │                    │                    │                   │              │
│     │   [Connection lost]│                    │   [Task running] │              │
│     │        ╳───────────╳                    │                   │              │
│     │                    │                    │    ┌──────────────┴──────────┐   │
│     │  [UI: Reconnecting]│                    │    │ Agent continues working │   │
│     │                    │                    │    │ (unaware of disconnect) │   │
│     │                    │                    │    │                         │   │
│     │                    │                    │    │ Progress updates        │   │
│     │                    │                    │◄ ─ ┤ queued in server        │   │
│     │                    │                    │    │                         │   │
│     │                    │                    │    └──────────────┬──────────┘   │
│     │                    │                    │                   │              │
│     │   [Reconnected]    │                    │                   │              │
│     │        ┌───────────┴───────────┐       │                   │              │
│     │        │ WebRTC re-established │       │                   │              │
│     │        └───────────┬───────────┘       │                   │              │
│     │                    │                    │                   │              │
│     │                    │  GET /session/     │                   │              │
│     │                    │  pending_updates   │                   │              │
│     │                    │───────────────────►│                   │              │
│     │                    │                    │                   │              │
│     │                    │  {queued_updates:  │                   │              │
│     │                    │   [{progress: 50%},│                   │              │
│     │                    │    {progress: 75%}]│                   │              │
│     │                    │  }                 │                   │              │
│     │                    │◄───────────────────│                   │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "We got            │                    │                   │              │
│     │   disconnected,    │                    │                   │              │
│     │   but the task is  │                    │                   │              │
│     │   still running -  │                    │                   │              │
│     │   75% complete."   │                    │                   │              │
│     │                    │                    │                   │              │
│     │  [UI: Shows        │                    │                   │              │
│     │   progress bar     │                    │                   │              │
│     │   at 75%]          │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │◄───────────────────│◄──────────────────│              │
│     │                    │  task_complete     │  Task finished    │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "Great news!      │                    │                   │              │
│     │   The task just    │                    │                   │              │
│     │   completed."      │                    │                   │              │
│     │                    │                    │                   │              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. Multi-Turn Conversation with Context

### 7.1 Basic Multi-Turn Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    MULTI-TURN CONVERSATION                                      │
│                    Context accumulates across turns                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │                    │  ┌─────────────────────────────────┐   │              │
│     │                    │  │ CONTEXT WINDOW                  │   │              │
│     │                    │  │ ================================│   │              │
│     │                    │  │ System prompt                   │   │              │
│     │                    │  │ Tools available                 │   │              │
│     │                    │  │ [empty conversation]            │   │              │
│     │                    │  └─────────────────────────────────┘   │              │
│     │                    │                    │                   │              │
│     │ ═══ TURN 1 ══════► │                    │                   │              │
│     │ "What files are    │                    │                   │              │
│     │  in src/?"         │                    │                   │              │
│     │                    │───────────────────►│──────────────────►│              │
│     │                    │  glob("src/*")     │                   │              │
│     │                    │◄───────────────────│◄──────────────────│              │
│     │◄═══════════════════│                    │                   │              │
│     │  "I found main.py, │                    │                   │              │
│     │   utils.py, and    │                    │                   │              │
│     │   config.py"       │                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │  ┌─────────────────────────────────┐   │              │
│     │                    │  │ CONTEXT WINDOW                  │   │              │
│     │                    │  │ ================================│   │              │
│     │                    │  │ System prompt + Tools           │   │              │
│     │                    │  │ + User: "What files..."         │   │              │
│     │                    │  │ + Tool: glob → [main,utils,cfg] │   │              │
│     │                    │  │ + Asst: "I found main.py..."    │   │              │
│     │                    │  └─────────────────────────────────┘   │              │
│     │                    │                    │                   │              │
│     │ ═══ TURN 2 ══════► │                    │                   │              │
│     │ "Show me the       │                    │                   │              │
│     │  first one"        │                    │                   │              │
│     │                    │          ┌─────────┴─────────┐        │              │
│     │                    │          │ LLM resolves      │        │              │
│     │                    │          │ "first one" to    │        │              │
│     │                    │          │ "main.py" from    │        │              │
│     │                    │          │ context           │        │              │
│     │                    │          └─────────┬─────────┘        │              │
│     │                    │───────────────────►│──────────────────►│              │
│     │                    │ read_file("src/main.py")               │              │
│     │                    │◄───────────────────│◄──────────────────│              │
│     │◄═══════════════════│                    │                   │              │
│     │  "Here's main.py:  │                    │                   │              │
│     │   it has a main    │                    │                   │              │
│     │   function that..."│                    │                   │              │
│     │                    │                    │                   │              │
│     │                    │  ┌─────────────────────────────────┐   │              │
│     │                    │  │ CONTEXT WINDOW                  │   │              │
│     │                    │  │ ================================│   │              │
│     │                    │  │ [Previous turns...]             │   │              │
│     │                    │  │ + User: "Show me the first one" │   │              │
│     │                    │  │ + Tool: read → content          │   │              │
│     │                    │  │ + Asst: "Here's main.py..."     │   │              │
│     │                    │  └─────────────────────────────────┘   │              │
│     │                    │                    │                   │              │
│     │ ═══ TURN 3 ══════► │                    │                   │              │
│     │ "Add logging to it"│                    │                   │              │
│     │                    │          ┌─────────┴─────────┐        │              │
│     │                    │          │ LLM understands   │        │              │
│     │                    │          │ "it" = main.py    │        │              │
│     │                    │          │ from context      │        │              │
│     │                    │          └─────────┬─────────┘        │              │
│     │                    │───────────────────►│──────────────────►│              │
│     │                    │  task("add logging │                   │              │
│     │                    │   to src/main.py") │                   │              │
│     │                    │                    │                   │              │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Context Window Management

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    CONTEXT WINDOW MANAGEMENT                                    │
│                    Handling long conversations                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                         CONTEXT BUDGET: 128K tokens                             │
│    ┌────────────────────────────────────────────────────────────────────┐       │
│    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │       │
│    │  │   SYSTEM     │  │    TOOLS     │  │    CONVERSATION          │  │       │
│    │  │   PROMPT     │  │  DEFINITIONS │  │       HISTORY            │  │       │
│    │  │              │  │              │  │                          │  │       │
│    │  │  ~2K tokens  │  │  ~3K tokens  │  │   Variable (grows)       │  │       │
│    │  │  [FIXED]     │  │  [FIXED]     │  │   [MANAGED]              │  │       │
│    │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │       │
│    └────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
│    CONTEXT MANAGEMENT STRATEGIES:                                               │
│                                                                                  │
│    1. FIFO Trimming (conversation grows beyond limit)                           │
│    ┌────────────────────────────────────────────────────────────────────┐       │
│    │                                                                    │       │
│    │  Before:  [Turn1][Turn2][Turn3][Turn4][Turn5][Turn6][Turn7]       │       │
│    │                                                      ▲ limit      │       │
│    │                                                                    │       │
│    │  After:   [Summary of T1-T3][Turn4][Turn5][Turn6][Turn7]          │       │
│    │           ▲ compressed                                             │       │
│    │                                                                    │       │
│    └────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
│    2. Tool Result Truncation                                                    │
│    ┌────────────────────────────────────────────────────────────────────┐       │
│    │                                                                    │       │
│    │  Large file (5000 lines) → Summarized to:                         │       │
│    │  "File src/data.py: 5000 lines, Python module containing          │       │
│    │   DataProcessor class with 12 methods. Key functions:             │       │
│    │   process(), validate(), export(). [Full content available        │       │
│    │   for specific sections on request]"                              │       │
│    │                                                                    │       │
│    └────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
│    3. Context Summarization (for session restore)                               │
│    ┌────────────────────────────────────────────────────────────────────┐       │
│    │                                                                    │       │
│    │  Full context → Compressed summary:                               │       │
│    │  {                                                                 │       │
│    │    "topic": "Adding authentication to user service",              │       │
│    │    "files_discussed": ["auth.py", "user.py", "tests/"],           │       │
│    │    "decisions_made": ["Use JWT", "Add refresh tokens"],           │       │
│    │    "pending_work": ["Implement token refresh"],                   │       │
│    │    "recent_turns": [last 5 turns verbatim]                        │       │
│    │  }                                                                 │       │
│    │                                                                    │       │
│    └────────────────────────────────────────────────────────────────────┘       │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Conversation with Interruption

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    MULTI-TURN WITH INTERRUPTION                                 │
│                    User interrupts while assistant speaking                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│    USER              VOICE MODEL           SERVER            AMPLIFIER           │
│     │                    │                    │                   │              │
│     │═══════════════════►│                    │                   │              │
│     │ "Explain how the   │                    │                   │              │
│     │  auth system works"│                    │                   │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "The auth system  │                    │                   │              │
│     │   uses JWT tokens  │                    │                   │              │
│     │   with a two-step  │                    │                   │              │
│     │   verification     │                    │                   │              │
│     │   process. First,  │                    │                   │              │
│     │   the user..."     │                    │                   │              │
│     │        │           │                    │                   │              │
│     │        │ [User starts speaking]        │                   │              │
│     │        ▼           │                    │                   │              │
│     │═══════════════════►│                    │                   │              │
│     │  "Wait, what's     │                    │                   │              │
│     │   a JWT?"          │                    │                   │              │
│     │                    │                    │                   │              │
│     │          ┌─────────┴─────────┐         │                   │              │
│     │          │ INTERRUPTION      │         │                   │              │
│     │          │ HANDLING:         │         │                   │              │
│     │          │ 1. VAD detects    │         │                   │              │
│     │          │    speech         │         │                   │              │
│     │          │ 2. Cancel current │         │                   │              │
│     │          │    response       │         │                   │              │
│     │          │ 3. Truncate       │         │                   │              │
│     │          │    context to     │         │                   │              │
│     │          │    what was heard │         │                   │              │
│     │          │ 4. Process new    │         │                   │              │
│     │          │    input          │         │                   │              │
│     │          └─────────┬─────────┘         │                   │              │
│     │                    │                    │                   │              │
│     │                    │  ┌─────────────────────────────────┐   │              │
│     │                    │  │ CONTEXT (after truncation)      │   │              │
│     │                    │  │ ================================│   │              │
│     │                    │  │ User: "Explain how auth works"  │   │              │
│     │                    │  │ Asst: "The auth system uses     │   │              │
│     │                    │  │        JWT tokens with a..."    │   │              │
│     │                    │  │        [TRUNCATED - user only   │   │              │
│     │                    │  │        heard this much]         │   │              │
│     │                    │  │ User: "Wait, what's a JWT?"     │   │              │
│     │                    │  └─────────────────────────────────┘   │              │
│     │                    │                    │                   │              │
│     │◄═══════════════════│                    │                   │              │
│     │  "JWT stands for   │                    │                   │              │
│     │   JSON Web Token.  │                    │                   │              │
│     │   It's a compact   │                    │                   │              │
│     │   way to securely  │                    │                   │              │
│     │   transmit info..."│                    │                   │              │
│     │                    │                    │                   │              │
│                                                                                  │
│   Truncation Calculation:                                                        │
│   ┌────────────────────────────────────────────────────────────────────────┐    │
│   │  audio_start_time = 1000ms                                             │    │
│   │  interrupt_time = 3500ms                                               │    │
│   │  playback_position = 2500ms (accounting for buffer)                    │    │
│   │                                                                         │    │
│   │  Truncate response at character position corresponding to 2500ms       │    │
│   │  of audio (approximately 40 words at normal speech rate)               │    │
│   └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Flow Comparison Summary

### 8.1 Latency Comparison

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    FLOW LATENCY COMPARISON                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  Flow Type                    │ Typical Latency │ Components                    │
│  ────────────────────────────┼─────────────────┼─────────────────────────────── │
│  Simple Query                 │   600-800ms     │ VAD + LLM + TTS               │
│  Fast Tool (web_search)       │   2-5s          │ + Tool execution              │
│  File Read + Explain          │   3-8s          │ + Multiple tools              │
│  Amplifier Simple Task        │   30-60s        │ + Agent work                  │
│  Amplifier Complex Task       │   2-10min       │ + Multi-agent                 │
│  Error Recovery               │   1-5s          │ + Error handling              │
│  Session Reconnection         │   3-8s          │ + WebRTC setup                │
│                                                                                  │
│  Timeline Visualization:                                                         │
│                                                                                  │
│  Simple Query:     ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │
│                    0   1s                                                        │
│                                                                                  │
│  Fast Tool:        ████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │
│                    0        5s                                                   │
│                                                                                  │
│  Amplifier Task:   ████████████████████████████████████████████████████████     │
│                    0                                                    60s     │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Decision Tree: Which Flow?

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    FLOW SELECTION DECISION TREE                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                         ┌─────────────────┐                                     │
│                         │  User Request   │                                     │
│                         └────────┬────────┘                                     │
│                                  │                                               │
│                                  ▼                                               │
│                    ┌─────────────────────────┐                                  │
│                    │  Needs external data?   │                                  │
│                    └─────────────┬───────────┘                                  │
│                          │               │                                       │
│                         NO              YES                                      │
│                          │               │                                       │
│                          ▼               ▼                                       │
│               ┌──────────────┐  ┌─────────────────────┐                         │
│               │ HAPPY PATH   │  │  Needs file write/  │                         │
│               │ (Direct LLM) │  │  code change?       │                         │
│               └──────────────┘  └──────────┬──────────┘                         │
│                                      │           │                               │
│                                     NO          YES                              │
│                                      │           │                               │
│                                      ▼           ▼                               │
│                            ┌──────────────┐  ┌─────────────────────┐            │
│                            │ TOOL FLOW    │  │  Simple or Complex? │            │
│                            │ (read_file,  │  └──────────┬──────────┘            │
│                            │  web_search) │       │           │                  │
│                            └──────────────┘    SIMPLE     COMPLEX               │
│                                                   │           │                  │
│                                                   ▼           ▼                  │
│                                          ┌──────────┐  ┌──────────────┐         │
│                                          │ TOOL +   │  │  AMPLIFIER   │         │
│                                          │ edit_file│  │  DELEGATION  │         │
│                                          └──────────┘  └──────────────┘         │
│                                                                                  │
│                                                                                  │
│   Examples:                                                                      │
│   ─────────────────────────────────────────────────────────────────────         │
│   "What time is it?"              → Happy Path                                   │
│   "Search for React patterns"     → Tool Flow (web_search)                      │
│   "Read src/main.py"              → Tool Flow (read_file)                       │
│   "Add a comment to line 10"      → Tool Flow (edit_file)                       │
│   "Implement user authentication" → Amplifier Delegation                        │
│   "Refactor the auth module"      → Amplifier Delegation                        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 State Transitions Summary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE STATE TRANSITION DIAGRAM                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│                              ┌───────────────┐                                  │
│                    ┌────────►│ DISCONNECTED  │◄────────┐                        │
│                    │         └───────┬───────┘         │                        │
│                    │                 │                 │                        │
│              timeout/         connect│           disconnect                     │
│              error                   ▼                 │                        │
│                    │         ┌───────────────┐        │                        │
│                    │    ┌───►│     IDLE      │◄───┐    │                        │
│                    │    │    └───────┬───────┘    │    │                        │
│                    │    │            │            │    │                        │
│                    │    │     speech │ audio.done │    │                        │
│                    │    │    started │            │    │                        │
│                    │    │            ▼            │    │                        │
│                    │    │    ┌───────────────┐    │    │                        │
│                    │    │    │   LISTENING   │    │    │                        │
│                    │    │    └───────┬───────┘    │    │                        │
│                    │    │            │            │    │                        │
│                    │    │     speech │            │    │                        │
│                    │    │    stopped │            │    │                        │
│                    │    │            ▼            │    │                        │
│                    │    │    ┌───────────────┐    │    │                        │
│              ┌─────┴────┴───►│  PROCESSING   │────┘    │                        │
│              │               └───┬───────┬───┘         │                        │
│              │                   │       │             │                        │
│              │          audio.delta    function_call   │                        │
│              │                   │       │             │                        │
│              │                   ▼       ▼             │                        │
│         error│           ┌───────────┐ ┌─────────────┐│                        │
│              │           │ SPEAKING  │ │TOOL_EXECUTING                         │
│              │           └─────┬─────┘ └──────┬──────┘│                        │
│              │                 │              │        │                        │
│              │         speech  │ audio  tool_done │   │                        │
│              │         started │ done         │       │                        │
│              │                 │              │       │                        │
│              │                 ▼              │       │                        │
│              │    ┌────────────┴──────────────┘       │                        │
│              │    │                                   │                        │
│              │    │   ┌───────────────────┐           │                        │
│              └────┴──►│ WAITING_AMPLIFIER │───────────┘                        │
│                       └───────────────────┘                                    │
│                                │                                                │
│                         task_complete                                           │
│                                │                                                │
│                                └─────► [back to PROCESSING/IDLE]               │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Appendix: Event Reference

### Key OpenAI Realtime Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `input_audio_buffer.speech_started` | Server→Client | VAD detected speech |
| `input_audio_buffer.speech_stopped` | Server→Client | VAD detected silence |
| `input_audio_buffer.committed` | Server→Client | Audio committed to context |
| `response.created` | Server→Client | Response generation started |
| `response.audio.delta` | Server→Client | Streaming audio chunk |
| `response.audio.done` | Server→Client | Audio streaming complete |
| `response.function_call_arguments.done` | Server→Client | Tool call ready |
| `conversation.item.truncate` | Client→Server | Truncate interrupted response |

### Key Server Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `tool_started` | Server→Client | Tool execution began |
| `tool_progress` | Server→Client | Tool progress update |
| `tool_completed` | Server→Client | Tool execution finished |
| `task_delegated` | Server→Client | Amplifier task started |
| `task_progress` | Server→Client | Amplifier progress update |
| `task_completed` | Server→Client | Amplifier task finished |
| `session_warning` | Server→Client | Session timeout approaching |
| `session_expired` | Server→Client | Session ended |

---

*This document provides visual reference for all major conversation flows in the Voice + Amplifier system.*

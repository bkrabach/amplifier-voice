# OpenAI Agents SDK Research

## Research Summary

The OpenAI Agents SDK is a lightweight, production-ready Python framework for building multi-agent workflows. It provides two distinct approaches for voice: **Voice Pipeline** (STT -> Agent -> TTS) and **Realtime Agents** (direct Realtime API integration). The SDK abstracts away the complexity of the raw Realtime API while providing tools, handoffs, guardrails, and tracing out of the box.

---

## 1. Agents SDK Overview

### What Is It?

The OpenAI Agents SDK is a lightweight yet powerful framework for building agentic AI applications. It's the production-ready evolution of OpenAI's experimental "Swarm" project.

**Repository:** https://github.com/openai/openai-agents-python  
**Documentation:** https://openai.github.io/openai-agents-python/

### Core Primitives

The SDK has a minimal set of abstractions:

| Primitive | Description |
|-----------|-------------|
| **Agent** | LLM equipped with instructions and tools |
| **Handoffs** | Allow agents to delegate to other agents |
| **Tools** | Functions the agent can call |
| **Guardrails** | Validation of agent inputs/outputs |
| **Sessions** | Persistent memory layer for context |

### Design Principles

1. **Enough features to be useful, few enough to learn quickly**
2. **Works great out of the box, but customizable**
3. **Python-first** - uses native language features, not new abstractions

### Installation

```bash
pip install openai-agents

# For voice features
pip install 'openai-agents[voice]'
```

### Basic Example

```python
from agents import Agent, Runner

agent = Agent(
    name="Assistant",
    instructions="You are a helpful assistant"
)

result = Runner.run_sync(agent, "Write a haiku about recursion")
print(result.final_output)
```

---

## 2. Voice Pipeline (STT -> Agent -> TTS)

The **VoicePipeline** is a 3-step architecture for converting voice to voice:

```
Audio Input -> STT -> Your Agent Code -> TTS -> Audio Output
```

### Architecture

```
┌─────────────────────────────────────────┐
│           Voice Pipeline                │
│  ┌────────────┐  ┌────────┐  ┌───────┐ │
│  │  Speech-   │  │  Your  │  │ Text- │ │
│  │  to-Text   │──│  Code  │──│ to-   │ │
│  │            │  │        │  │Speech │ │
│  └────────────┘  └────────┘  └───────┘ │
└─────────────────────────────────────────┘
```

### Key Characteristics

- **Non-realtime** - processes complete audio transcripts
- Uses separate STT and TTS models (e.g., Whisper, TTS-1)
- Can use **any** Agent/LLM workflow in the middle
- Good for push-to-talk or pre-recorded audio

### Voice Pipeline Example

```python
from agents import Agent, function_tool
from agents.voice import SingleAgentVoiceWorkflow, VoicePipeline, AudioInput
import numpy as np

@function_tool
def get_weather(city: str) -> str:
    """Get the weather for a given city."""
    return f"The weather in {city} is sunny."

agent = Agent(
    name="Assistant",
    instructions="You're speaking to a human, be concise.",
    tools=[get_weather],
)

# Create pipeline
pipeline = VoicePipeline(workflow=SingleAgentVoiceWorkflow(agent))

# Run with audio
audio_input = AudioInput(buffer=audio_data)
result = await pipeline.run(audio_input)

# Stream output audio
async for event in result.stream():
    if event.type == "voice_stream_event_audio":
        play_audio(event.data)
```

### Audio Input Modes

| Mode | Use Case |
|------|----------|
| `AudioInput` | Full audio transcript, push-to-talk |
| `StreamedAudioInput` | Streaming with activity detection |

### Limitations

- **No built-in interruption support** for StreamedAudioInput
- Higher latency than Realtime API (separate STT/TTS calls)
- Each detected turn triggers separate workflow run

---

## 3. Realtime Agents (Direct Realtime API)

**RealtimeAgent** provides direct integration with OpenAI's Realtime API for true speech-to-speech conversations with low latency.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Realtime System                    │
│  ┌───────────────┐  ┌────────────┐  ┌────────────┐ │
│  │ RealtimeAgent │──│ Realtime   │──│ Realtime   │ │
│  │ (config)      │  │ Runner     │  │ Session    │ │
│  └───────────────┘  └────────────┘  └────────────┘ │
│                           │                         │
│                    ┌──────▼──────┐                  │
│                    │  Realtime   │                  │
│                    │  Model      │                  │
│                    │ (WebSocket) │                  │
│                    └─────────────┘                  │
└─────────────────────────────────────────────────────┘
```

### Core Components

| Component | Role |
|-----------|------|
| `RealtimeAgent` | Agent with instructions, tools, handoffs |
| `RealtimeRunner` | Manages configuration, creates sessions |
| `RealtimeSession` | Single conversation session |
| `RealtimeModel` | WebSocket connection to Realtime API |

### Key Characteristics

- **True speech-to-speech** - model handles audio directly
- **Low latency** - persistent WebSocket connection
- **Automatic interruption handling** - graceful barge-in support
- **Native turn detection** - semantic VAD built-in

### Realtime Agent Example

```python
import asyncio
from agents.realtime import RealtimeAgent, RealtimeRunner

agent = RealtimeAgent(
    name="Assistant",
    instructions="You are a helpful voice assistant.",
)

runner = RealtimeRunner(
    starting_agent=agent,
    config={
        "model_settings": {
            "model_name": "gpt-realtime",
            "voice": "ash",
            "modalities": ["audio"],
            "input_audio_format": "pcm16",
            "output_audio_format": "pcm16",
            "input_audio_transcription": {"model": "gpt-4o-mini-transcribe"},
            "turn_detection": {"type": "semantic_vad", "interrupt_response": True},
        }
    },
)

session = await runner.run()
async with session:
    async for event in session:
        if event.type == "audio":
            # Play audio chunk
            pass
        elif event.type == "audio_interrupted":
            # Stop playback, clear queue
            pass
        elif event.type == "tool_start":
            print(f"Tool: {event.tool.name}")
```

### Session Events

| Event Type | Description |
|------------|-------------|
| `audio` | Raw audio chunk from agent |
| `audio_end` | Agent finished speaking |
| `audio_interrupted` | User interrupted agent |
| `tool_start` / `tool_end` | Tool execution lifecycle |
| `handoff` | Agent handoff occurred |
| `error` | Error during processing |

### Configuration Options

**Model Settings:**
- `model_name`: e.g., `gpt-realtime`
- `voice`: alloy, echo, fable, onyx, nova, shimmer, ash
- `modalities`: `["text"]` or `["audio"]`

**Audio Settings:**
- `input_audio_format`: pcm16, g711_ulaw, g711_alaw
- `output_audio_format`: pcm16, g711_ulaw, g711_alaw
- `input_audio_transcription`: Whisper config

**Turn Detection:**
- `type`: `server_vad` or `semantic_vad`
- `threshold`: 0.0-1.0
- `silence_duration_ms`: silence to detect turn end
- `interrupt_response`: enable barge-in

### Differences from Regular Agent

| Feature | Regular Agent | RealtimeAgent |
|---------|---------------|---------------|
| Model config | Agent level | Session level |
| Structured output | Supported | Not supported |
| Voice | N/A | Per-agent, fixed after first speech |
| Tools | Same | Same |
| Handoffs | Same | Same |

---

## 4. Tool Integration

Tools work identically across regular agents, voice pipelines, and realtime agents.

### Function Tools

```python
from agents import function_tool

@function_tool
def get_weather(city: str) -> str:
    """Get current weather for a city."""
    return f"The weather in {city} is sunny, 72°F"

@function_tool
def book_appointment(date: str, time: str, service: str) -> str:
    """Book an appointment."""
    return f"Appointment booked for {service} on {date} at {time}"

agent = RealtimeAgent(
    name="Assistant",
    instructions="You can help with weather and appointments.",
    tools=[get_weather, book_appointment],
)
```

### Tool Types

| Type | Description |
|------|-------------|
| **Hosted Tools** | Run on OpenAI servers (WebSearch, FileSearch, CodeInterpreter) |
| **Function Tools** | Python functions with auto-generated schemas |
| **Agents as Tools** | Use another agent as a callable tool |
| **MCP Tools** | Model Context Protocol integration |

### Automatic Schema Generation

The SDK automatically:
- Extracts function signature
- Generates JSON schema from types
- Parses docstrings for descriptions
- Validates with Pydantic

```python
from typing import TypedDict

class Location(TypedDict):
    lat: float
    long: float

@function_tool
async def fetch_weather(location: Location) -> str:
    """Fetch the weather for a given location.
    
    Args:
        location: The location to fetch the weather for.
    """
    return "sunny"
```

---

## 5. Handoffs

Handoffs allow transferring conversations between specialized agents.

### Realtime Handoffs

```python
from agents.realtime import RealtimeAgent, realtime_handoff

billing_agent = RealtimeAgent(
    name="Billing Support",
    instructions="You specialize in billing and payment issues.",
)

technical_agent = RealtimeAgent(
    name="Technical Support",
    instructions="You handle technical troubleshooting.",
)

main_agent = RealtimeAgent(
    name="Customer Service",
    instructions="Hand off to specialists when needed.",
    handoffs=[
        realtime_handoff(billing_agent, tool_description="Transfer to billing"),
        realtime_handoff(technical_agent, tool_description="Transfer to tech"),
    ]
)
```

---

## 6. Guardrails

### Realtime Guardrails

Only **output guardrails** are supported for realtime agents:

```python
from agents.guardrail import GuardrailFunctionOutput, OutputGuardrail

def sensitive_data_check(context, agent, output):
    return GuardrailFunctionOutput(
        tripwire_triggered="password" in output,
        output_info=None,
    )

agent = RealtimeAgent(
    name="Assistant",
    instructions="...",
    output_guardrails=[OutputGuardrail(guardrail_function=sensitive_data_check)],
)
```

**Key Points:**
- Guardrails are **debounced** (default 100 chars) for performance
- Triggered guardrails generate `guardrail_tripped` event
- Can interrupt agent's current response
- No exception raised (unlike text agents)

---

## 7. Voice Pipeline vs Realtime Agents

| Feature | Voice Pipeline | Realtime Agents |
|---------|----------------|-----------------|
| **Latency** | Higher (separate STT/TTS) | Low (native speech-to-speech) |
| **Model flexibility** | Any LLM | Realtime models only |
| **Interruption** | Manual handling | Built-in |
| **Turn detection** | Via StreamedAudioInput | Native semantic VAD |
| **Connection** | Request/response | Persistent WebSocket |
| **Use case** | Push-to-talk, batch | Real-time conversation |
| **Cost** | STT + LLM + TTS | Single Realtime API call |

### When to Use Each

**Use Voice Pipeline when:**
- You need to use non-realtime models
- Push-to-talk is acceptable
- Processing pre-recorded audio
- Cost optimization is priority

**Use Realtime Agents when:**
- Low latency is critical
- Natural conversation flow needed
- Interruption handling required
- Building phone/voice assistants

---

## 8. Benefits vs Raw Realtime API

### SDK Advantages

| Benefit | Description |
|---------|-------------|
| **Agent Loop** | Automatic tool invocation, result handling, continuation |
| **Tool Schema** | Auto-generated from Python functions with validation |
| **Handoffs** | Built-in agent-to-agent transfers |
| **Guardrails** | Output validation with debouncing |
| **Tracing** | Built-in visualization and debugging |
| **Sessions** | Persistent memory management |
| **Event Abstraction** | Clean event types vs raw WebSocket messages |
| **Error Handling** | Graceful error recovery |

### Raw Realtime API Complexity

Without the SDK, you must manually:
- Manage WebSocket connection lifecycle
- Handle all event types and responses
- Build tool schema JSON manually
- Implement tool execution loop
- Handle interruptions and state
- Manage conversation history
- Implement retry logic

### SDK Simplification

```python
# Raw Realtime API: ~200+ lines of WebSocket management
# SDK Equivalent: ~20 lines

from agents.realtime import RealtimeAgent, RealtimeRunner

agent = RealtimeAgent(
    name="Assistant",
    instructions="You are helpful.",
    tools=[my_tool],
    handoffs=[specialist_agent],
)

runner = RealtimeRunner(starting_agent=agent)
session = await runner.run()

async for event in session:
    handle(event)
```

---

## 9. SIP/Telephony Integration

The SDK supports phone call integration via SIP:

```python
from agents.realtime import RealtimeAgent, RealtimeRunner
from agents.realtime.openai_realtime import OpenAIRealtimeSIPModel

runner = RealtimeRunner(
    starting_agent=agent,
    model=OpenAIRealtimeSIPModel(),
)

async with await runner.run(
    model_config={
        "call_id": call_id_from_webhook,
        "initial_model_settings": {
            "turn_detection": {"type": "semantic_vad", "interrupt_response": True},
        },
    },
) as session:
    async for event in session:
        handle(event)
```

---

## 10. Summary & Recommendations

### For Amplifier Voice Integration

1. **RealtimeAgent is the preferred approach** for low-latency voice
2. **Tools integrate seamlessly** - same `@function_tool` pattern
3. **Handoffs enable multi-agent** voice workflows
4. **Guardrails provide safety** with performance-aware debouncing
5. **Tracing built-in** for debugging and monitoring

### Architecture Pattern

```
User Audio
    │
    ▼
RealtimeSession ──────────────────────────────┐
    │                                         │
    ▼                                         │
RealtimeAgent                                 │
    ├── instructions                          │
    ├── tools[] ◄──── @function_tool          │
    ├── handoffs[] ◄── other RealtimeAgents   │
    └── output_guardrails[]                   │
    │                                         │
    ▼                                         │
OpenAI Realtime API (WebSocket) ◄─────────────┘
    │
    ▼
Audio Response
```

---

## Sources

1. **OpenAI Agents SDK Documentation**  
   https://openai.github.io/openai-agents-python/

2. **GitHub Repository**  
   https://github.com/openai/openai-agents-python

3. **Realtime Agents Guide**  
   https://openai.github.io/openai-agents-python/realtime/guide/

4. **Voice Pipeline Documentation**  
   https://openai.github.io/openai-agents-python/voice/pipeline/

5. **Tools Documentation**  
   https://openai.github.io/openai-agents-python/tools/

---

## Confidence Level

**High** - Information sourced from official OpenAI documentation and GitHub repository. The Agents SDK is actively maintained with recent updates.

## Gaps

- TypeScript SDK has different features (WebRTC browser support)
- Pricing details for Realtime API not covered
- Performance benchmarks not available in docs
- Beta status means API may change

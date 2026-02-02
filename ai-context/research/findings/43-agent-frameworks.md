# Voice AI Agent Frameworks Research

**Research Date:** January 2026  
**Focus:** LiveKit Agents, Pipecat, LangChain/LangGraph voice integration

---

## Executive Summary

The voice AI agent framework landscape has matured significantly, with two open-source frameworks emerging as leaders: **LiveKit Agents** and **Pipecat**. Both enable real-time voice AI applications but differ fundamentally in architecture philosophy. LiveKit emphasizes event-driven simplicity with built-in infrastructure, while Pipecat prioritizes pipeline flexibility and vendor neutrality. LangChain/LangGraph provides voice capabilities through the "sandwich architecture" pattern, integrating STT → Agent → TTS components.

---

## 1. LiveKit Agents SDK

### Overview
LiveKit Agents is a Python and Node.js framework for building real-time, programmable voice and multimodal AI agents. It runs agents as full participants in WebRTC rooms, handling media streaming, turn detection, interruptions, and session orchestration.

**GitHub:** https://github.com/livekit/agents  
**Stars:** ~9.2k (as of Jan 2026)  
**License:** Apache 2.0  
**Languages:** Python, TypeScript/Node.js

### Architecture Philosophy
- **Event-driven design** with automatic state management
- Agents declare behavior; framework handles orchestration
- Tight integration with LiveKit's WebRTC infrastructure
- Production-focused with built-in scaling

### Key Features

| Feature | Description |
|---------|-------------|
| **Multimodal Support** | Voice, video, text, and vision processing |
| **Plugin Ecosystem** | 40+ plugins for STT, TTS, LLM, and realtime providers |
| **Turn Detection** | Custom transformer-based model (99%+ true positive, 85-96% true negative) |
| **Interruption Handling** | Automatic, built into framework |
| **Telephony** | Native SIP integration, phone numbers $1-2/mo |
| **Client SDKs** | Integrated state sync with web/mobile clients |
| **Avatar Support** | Built-in Hedra, HeyGen integrations |
| **Observability** | Built-in Agent Insights (traces, transcripts, session playback) |
| **Testing** | Built-in pytest + LLM-as-judge evaluation |

### Supported Providers

**STT:** Deepgram, OpenAI Whisper, AssemblyAI, Google, Azure, and more  
**TTS:** Cartesia, ElevenLabs, OpenAI, Google, Azure, PlayHT, and more  
**LLM:** OpenAI, Anthropic, Google, Groq, xAI, Cerebras, Azure, AWS  
**Realtime:** OpenAI Realtime API, Google Gemini Live

### Code Example

```python
from livekit import agents
from livekit.agents import AgentServer, AgentSession, Agent

class Assistant(Agent):
    def __init__(self):
        super().__init__(instructions="You are a helpful assistant.")

server = AgentServer()

@server.rtc_session()
async def entrypoint(ctx: agents.JobContext):
    session = AgentSession(
        stt="deepgram/nova-3",
        llm="openai/gpt-4o-mini",
        tts="cartesia/sonic",
    )
    await session.start(agent=Assistant(), room=ctx.room)
    await session.generate_reply(instructions="Greet the user.")

if __name__ == "__main__":
    agents.cli.run_app(server)
```

### Deployment Options
- **LiveKit Cloud**: Managed hosting with global infrastructure
- **Self-hosted**: Kubernetes-compatible, automatic load balancing
- **Agent Builder**: No-code prototyping in browser

### Production Users
ChatGPT Advanced Voice Mode, Grok, Tesla, Agentforce

---

## 2. Pipecat (Daily.co)

### Overview
Pipecat is an open-source Python framework for building real-time voice and multimodal conversational agents. Created by Daily.co, it emphasizes flexible pipeline architecture and vendor neutrality.

**GitHub:** https://github.com/pipecat-ai/pipecat  
**Stars:** ~10.1k (as of Jan 2026)  
**License:** BSD-2-Clause  
**Website:** https://www.pipecat.ai/  
**Language:** Python

### Architecture Philosophy
- **Pipeline-based design** with explicit component wiring
- "Just Python code" - lower-level, maximum flexibility
- Vendor-neutral transport layer
- Manual state and frame management

### Key Features

| Feature | Description |
|---------|-------------|
| **Pipeline Architecture** | Complex, parallel processing paths supported |
| **Component Library** | 100+ pre-built services |
| **Turn Detection** | Smart TurnDetection v3 model |
| **Transport Options** | Daily.co, LiveKit (audio-only), Twilio, Local, WebRTC |
| **Multimodal** | Audio + Video + Images |
| **Visual Flow Editor** | Pipecat Flows for conversation design |

### Supported Providers

**STT:** AssemblyAI, Deepgram, Whisper, Google, Azure, and more  
**TTS:** ElevenLabs, Cartesia, OpenAI, Amazon Polly, Azure, Google, PlayHT  
**LLM:** OpenAI, Anthropic, Google, Groq, custom models via API

### Code Example

```python
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.services.deepgram import DeepgramSTTService
from pipecat.services.openai import OpenAILLMService
from pipecat.services.cartesia import CartesiaTTSService
from pipecat.transports.services.daily import DailyTransport

async def main():
    transport = DailyTransport(room_url, token, "Bot", DailyParams(...))
    stt = DeepgramSTTService(api_key=DEEPGRAM_KEY)
    llm = OpenAILLMService(api_key=OPENAI_KEY, model="gpt-4o-mini")
    tts = CartesiaTTSService(api_key=CARTESIA_KEY, voice_id="...")
    
    context = OpenAILLMContext([{"role": "system", "content": "You are helpful."}])
    context_aggregator = llm.create_context_aggregator(context)
    
    pipeline = Pipeline([
        transport.input(),
        stt,
        context_aggregator.user(),
        llm,
        tts,
        transport.output(),
        context_aggregator.assistant(),
    ])
    
    task = PipelineTask(pipeline, PipelineParams(allow_interruptions=True))
    runner = PipelineRunner()
    await runner.run(task)
```

### Deployment Options
- **Self-hosted**: Full control over infrastructure
- **Pipecat Cloud**: Managed service option
- **Docker**: Containerized deployment

### NVIDIA Partnership
Featured in NVIDIA's Voice Agent Framework for Conversational AI Blueprint, supporting 40+ AI models and offering SDKs for Python, JavaScript, React, iOS, Android, and C++.

---

## 3. LangChain/LangGraph Voice Integration

### Overview
LangChain provides voice agent capabilities through the "sandwich architecture" - composing STT, a text-based LangChain agent, and TTS into a streaming pipeline. LangGraph can be integrated with LiveKit for full-duplex voice experiences.

**Documentation:** https://docs.langchain.com/oss/python/langchain/voice-agent  
**Demo Repo:** voice-sandwich-demo

### Architecture: The "Sandwich" Pattern

```
Audio Input → STT → LangChain Agent → TTS → Audio Output
```

**Pros:**
- Full control over each component (swap providers as needed)
- Access to latest text-modality model capabilities
- Transparent behavior with clear component boundaries
- Sub-700ms latency achievable with optimized providers

**Cons:**
- Requires orchestrating multiple services
- Speech-to-text conversion loses tone/emotion information
- Additional complexity in pipeline management

### Key Components

1. **Speech-to-Text (STT)**
   - Producer-consumer pattern for concurrent audio streaming
   - Example providers: AssemblyAI, Deepgram
   - WebSocket connections for real-time transcription

2. **LangChain Agent**
   - Uses `stream_mode="messages"` for token streaming
   - InMemorySaver for conversation state
   - Tool calling support (add_to_order, confirm_order, etc.)

3. **Text-to-Speech (TTS)**
   - Concurrent processing with upstream events
   - Example providers: Cartesia, ElevenLabs
   - Streaming synthesis starts before agent finishes

### Code Example (Pipeline Composition)

```python
from langchain_core.runnables import RunnableGenerator

pipeline = (
    RunnableGenerator(stt_stream)      # Audio → STT events
    | RunnableGenerator(agent_stream)   # STT events → Agent events
    | RunnableGenerator(tts_stream)     # Agent events → TTS audio
)

# Use in WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    
    async def websocket_audio_stream():
        while True:
            data = await websocket.receive_bytes()
            yield data
    
    output_stream = pipeline.atransform(websocket_audio_stream())
    
    async for event in output_stream:
        if event.type == "tts_chunk":
            await websocket.send_bytes(event.audio)
```

### LangGraph + LiveKit Integration
LiveKit provides official LangGraph integration for using LangGraph workflows with LiveKit Agents:
- Full-duplex, low-latency voice assistant
- Adapts any LangGraph agent to voice
- Documentation: https://docs.livekit.io/agents/models/llm/plugins/langchain/

---

## 4. Framework Comparison

### Architecture Comparison

| Aspect | LiveKit Agents | Pipecat | LangChain/LangGraph |
|--------|---------------|---------|---------------------|
| **Design** | Event-driven, declarative | Pipeline-based, imperative | Sandwich composition |
| **State Management** | Automatic | Manual (frame-based) | Manual with checkpointers |
| **Boilerplate** | ~20 lines | ~40 lines | ~60+ lines |
| **Learning Curve** | Gentle to moderate | Moderate to steep | Moderate |
| **Primary Language** | Python, TypeScript | Python | Python |

### Feature Comparison

| Feature | LiveKit Agents | Pipecat | LangChain Voice |
|---------|---------------|---------|-----------------|
| **Turn Detection** | Transformer model | Smart Turn v3 | Manual/VAD |
| **Interruptions** | Automatic | Manual via frames | Manual |
| **Telephony** | Native SIP | Via Daily bridge | Via transport |
| **Phone Numbers** | $1-2/mo built-in | Third-party required | Third-party |
| **Observability** | Built-in (Agent Insights) | Third-party | Third-party |
| **Testing** | Built-in pytest + LLM-judge | External tools | External tools |
| **Client SDKs** | Integrated state sync | Transport-dependent | Manual |
| **Avatar Support** | Built-in (Hedra, etc.) | Separate integration | N/A |
| **Visual Builder** | Agent Builder (no-code) | Pipecat Flows | N/A |

### When to Choose Each

#### Choose LiveKit Agents When:
- Production scalability is critical
- You need rapid deployment with minimal configuration
- Native telephony/SIP support is required
- Integrated observability and testing matter
- Building video-first or multimodal applications
- Team has varying WebRTC expertise levels

#### Choose Pipecat When:
- Maximum flexibility over pipeline logic is needed
- Custom parallel processing paths are required
- Already using Daily.co, Twilio, or other platforms
- Research/experimentation with rapid iteration
- "Just Python" approach is preferred
- Visual flow editing (Pipecat Flows) is valuable

#### Choose LangChain/LangGraph When:
- Already invested in LangChain ecosystem
- Need sophisticated agent reasoning/tool use
- Want transparent component boundaries
- Building STT → Agent → TTS workflows
- Integrating with existing LangGraph workflows

---

## 5. Additional Voice AI Platforms (Reference)

### Full-Stack Control Platforms
| Platform | Type | Pricing | Use Case |
|----------|------|---------|----------|
| **Vapi.ai** | Modular API | $0.05-$0.13/min | Custom AI agents with full stack control |
| **Ultravox** | Enterprise orchestration | $0.05/min, $100+/mo | Regulated industries, high compliance |
| **Retell AI** | Real-time call agent | $0.07-$0.12/min | Healthcare, insurance, compliance-critical |
| **Bland AI** | Call automation | $0.11-$0.14/min | SDR automation, outbound campaigns |

### Infrastructure & Components
| Platform | Type | Pricing | Use Case |
|----------|------|---------|----------|
| **Telnyx** | Telecom infrastructure | $0.002-$0.01/min | Global telephony, SIP/PSTN control |
| **ElevenLabs** | TTS engine | From $5/mo | Expressive branded voices |
| **Deepgram** | STT engine | ~$0.24/min | Real-time transcription, analytics |

### No-Code Solutions
| Platform | Type | Pricing | Use Case |
|----------|------|---------|----------|
| **Synthflow** | No-code builder | $50+/mo | SMBs, marketing, fast deployment |
| **Cognigy.AI** | Enterprise no-code | Custom | Corporate IT, HR, helpdesk |

---

## 6. Key Technical Considerations

### Latency Targets
- **Target:** Sub-500ms round-trip for natural conversations
- **Achievable:** Sub-300ms with optimized STT (Deepgram) + streaming TTS
- **Bottlenecks:** LLM inference time, network hops, audio processing

### Critical Architecture Decisions

1. **Turn Detection Model**
   - Silero VAD (basic voice activity detection)
   - Transformer-based models (LiveKit, Pipecat Smart Turn)
   - Critical for natural conversation flow

2. **Interruption Handling**
   - Automatic (LiveKit) vs Manual (Pipecat)
   - Barge-in detection and graceful response truncation

3. **Transport Layer**
   - WebRTC for low-latency browser/mobile
   - SIP for telephony integration
   - WebSockets for custom implementations

4. **State Management**
   - Session memory for multi-turn conversations
   - Context carryover during transfers
   - Checkpoint persistence for reliability

---

## 7. Recommendations

### For Production Voice AI Applications
**Primary:** LiveKit Agents  
**Rationale:** Production-ready infrastructure, built-in observability, native telephony, automatic scaling, proven at scale (ChatGPT, Grok, Tesla).

### For Maximum Flexibility/Research
**Primary:** Pipecat  
**Rationale:** Pipeline flexibility, vendor neutrality, lower-level control, good for custom implementations and experimentation.

### For Existing LangChain Users
**Primary:** LangChain Sandwich + LiveKit Integration  
**Rationale:** Leverages existing LangChain/LangGraph investments, transparent component boundaries, can integrate with LiveKit for transport.

### Hybrid Approach
Consider using:
- **LiveKit** for transport, turn detection, and infrastructure
- **LangGraph** for complex agent reasoning and workflows
- **Best-in-class providers** for STT (Deepgram) and TTS (Cartesia/ElevenLabs)

---

## Sources

1. LiveKit Documentation - https://docs.livekit.io/agents/
2. LiveKit GitHub - https://github.com/livekit/agents
3. Pipecat GitHub - https://github.com/pipecat-ai/pipecat
4. Pipecat Website - https://www.pipecat.ai/
5. LangChain Voice Agent Guide - https://docs.langchain.com/oss/python/langchain/voice-agent
6. LiveKit vs Pipecat Comparison - https://livekit.io/field-guides/guide/livekit-vs-pipecat
7. Pipecat vs LiveKit Analysis - https://aize.dev/992/pipecat-vs-livekit-which-voice-ai-framework-should-you-choose/
8. Voice Agent Platforms Comparison (Softcery) - https://softcery.com/lab/choosing-the-right-voice-agent-platform-in-2025
9. OpenAI-LiveKit Partnership - https://blog.livekit.io/openai-livekit-partnership-advanced-voice-realtime-api/
10. LangGraph-LiveKit Integration - https://docs.livekit.io/agents/models/llm/plugins/langchain/

# Real-Time Collaboration with Voice AI

> Research conducted: January 2026
> Focus: Multi-user voice sessions, voice + shared screen/whiteboard, meeting assistant patterns, turn-taking in multi-party conversations

## Executive Summary

Real-time collaboration with voice AI is an emerging field combining WebRTC infrastructure, multi-agent AI systems, and sophisticated turn-taking protocols. The key architectural patterns involve SFU-based media routing, speaker diarization for multi-party identification, and floor management systems for coordinating multi-agent conversations. Production implementations leverage frameworks like LiveKit and Pipecat for infrastructure, while emerging standards like OVON provide interoperability specifications for multi-agent voice systems.

---

## 1. Multi-User Voice Sessions

### 1.1 Architecture Patterns

#### WebRTC SFU (Selective Forwarding Unit) Architecture
The dominant architecture for multi-party voice involves SFU media servers that route audio streams between participants:

```
┌─────────────────────────────────────────────────────────┐
│                    SFU Media Server                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Session (Room)                      │   │
│  │   participants: [P1, P2, P3, AI_Agent]          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
        ↕           ↕           ↕           ↕
    [User 1]    [User 2]    [User 3]   [AI Agent]
```

**Key Components:**
- **Media Server**: Routes audio/video packets between participants
- **Session/Room**: Stateful container holding participant state
- **Transport Layer**: WebRTC for real-time, low-latency delivery

#### Multi-Home Architecture for Scale
LiveKit's approach to global scale involves distributed mesh networks:

- **Single-home limitation**: One server hosts entire session = single point of failure
- **Multi-home solution**: Session spans multiple servers across data centers
- **State synchronization**: Message bus distributes participant metadata
- **Live migrations**: ICE restart enables seamless server failover

**Source**: [LiveKit Distributed Mesh Architecture](https://blog.livekit.io/scaling-webrtc-with-distributed-mesh/)

### 1.2 Framework Implementations

#### LiveKit Agents
LiveKit provides infrastructure for multi-participant AI voice agents:

```python
# LiveKit multi-participant voice agent pattern
from livekit import agents

class MultiParticipantAgent:
    def __init__(self, room):
        self.room = room
        self.participants = {}
    
    async def on_participant_connected(self, participant):
        # Track each participant separately
        self.participants[participant.identity] = {
            "audio_track": None,
            "transcription_context": []
        }
    
    async def process_room_audio(self):
        # Handle audio from all participants
        # Apply speaker diarization
        pass
```

**Key Features:**
- Multi-participant room support
- Data channels alongside audio streams
- Dynamic participant lifecycle management
- Push-to-talk mechanism for multi-user conversations

**Source**: [LiveKitTransport - Pipecat](https://docs.pipecat.ai/server/services/transport/livekit)

#### Pipecat Framework
Pipecat provides vendor-neutral agent layer with LiveKit integration:

- **Integrations**: 60+ AI models and services
- **Transport options**: WebSockets, WebRTC, HTTP, telephony
- **Multi-participant**: Via LiveKit transport layer
- **State management**: Session context across participants

### 1.3 Real-Time Bidirectional Streaming

Google's Agent Development Kit (ADK) introduces streaming-native architecture:

**Key Concepts:**

1. **LiveRequestQueue**: Async queue for continuous multimodal input
```python
class LiveRequestQueue:
    def send_content(self, content: types.Content):
        self._queue.put_nowait(LiveRequest(content=content))
    
    def send_realtime(self, blob: types.Blob):
        self._queue.put_nowait(LiveRequest(blob=blob))
    
    def send_activity_start(self):
        self._queue.put_nowait(LiveRequest(activity_start=types.ActivityStart()))
```

2. **Stateful Sessions**: Context persists across live interaction
3. **Event-driven Callbacks**: Hooks for before/after tool execution
4. **Streaming Tools**: AsyncGenerators that yield multiple results

**Benefits for Multi-User:**
- True concurrency and interruptibility
- Unified multimodal processing
- Proactive assistance with background tools

**Source**: [Google Developers Blog - ADK Architecture](https://developers.googleblog.com/en/beyond-request-response-architecting-real-time-bidirectional-streaming-multi-agent-system/)

---

## 2. Voice + Shared Screen/Whiteboard

### 2.1 Current Integration Landscape

#### AI Whiteboard Tools
Modern collaborative whiteboards with AI features:

| Tool | AI Features | Voice Integration |
|------|-------------|-------------------|
| **Miro** | AI assistant, content generation, clustering | Limited (via integrations) |
| **FigJam** | Jambot AI, summarization, ideation | Limited |
| **Boardmix** | AI-powered mind maps, flowcharts | Native voice notes |
| **ClickUp** | AI brainstorming, task extraction | Via meeting integrations |

#### Integration Patterns

**Pattern 1: Voice Commands to Whiteboard Actions**
```
User Voice → STT → LLM Intent → Whiteboard API
     ↓
"Add a sticky note saying 'Review Q1 metrics'"
     ↓
Whiteboard.addStickyNote({text: "Review Q1 metrics"})
```

**Pattern 2: Meeting Context to Visual Artifacts**
```
Meeting Transcription → LLM Extraction → Visual Generation
     ↓
Extract: action items, decisions, topics
     ↓
Generate: mind map, kanban board, timeline
```

### 2.2 Architecture for Voice-Enabled Collaboration

```
┌─────────────────────────────────────────────────────────────────┐
│                    Collaboration Session                         │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Voice Layer  │  │ Visual Layer │  │ Shared State Layer   │  │
│  │              │  │              │  │                      │  │
│  │ - WebRTC     │  │ - Canvas     │  │ - CRDT/OT sync      │  │
│  │ - STT/TTS    │  │ - Cursors    │  │ - Presence          │  │
│  │ - Speaker ID │  │ - Annotations│  │ - Action history    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│           ↓                ↓                    ↓                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              AI Processing Layer                         │   │
│  │  - Voice command interpretation                          │   │
│  │  - Content extraction from conversation                  │   │
│  │  - Real-time summarization                               │   │
│  │  - Action item detection                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Multimodal Considerations

From Voice AI research, multimodal processing challenges include:

- **Token consumption**: Images ~250 tokens, 1 min video ~15,000 tokens
- **Latency vs context**: Large contexts degrade response time
- **Caching strategies**: Essential for interactive multimodal sessions

**Recommendation**: Use text summaries of visual content for LLM context, with on-demand image/video retrieval via function calls.

---

## 3. Meeting Assistant Patterns

### 3.1 Meeting Bot Architecture

#### Recall.ai Pattern
Meeting bots that join video conferences as participants:

```
┌────────────────────────────────────────────────────────┐
│                  Meeting Bot Service                    │
├────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Zoom Bot    │  │ Teams Bot   │  │ Meet Bot    │    │
│  │ (SDK-based) │  │ (Graph API) │  │ (Puppeteer) │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│           ↓               ↓               ↓            │
│  ┌────────────────────────────────────────────────┐   │
│  │           Unified Audio Pipeline               │   │
│  │  - Audio capture                               │   │
│  │  - Speaker diarization                         │   │
│  │  - Real-time transcription                     │   │
│  └────────────────────────────────────────────────┘   │
│                          ↓                             │
│  ┌────────────────────────────────────────────────┐   │
│  │           AI Processing                        │   │
│  │  - Summarization                               │   │
│  │  - Action item extraction                      │   │
│  │  - Decision logging                            │   │
│  │  - Q&A / Knowledge retrieval                   │   │
│  └────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────┘
```

**Key Meeting Assistant Players:**
- **Otter.ai**: Real-time transcription, speaker identification, searchable notes
- **Fireflies.ai**: Multi-platform support, CRM integration, AI summaries
- **Microsoft Copilot**: Native Teams integration, action items, recap generation

### 3.2 Real-Time Processing Pipeline

```python
# Meeting assistant processing pattern
class MeetingAssistant:
    def __init__(self):
        self.transcription_buffer = []
        self.speakers = {}
        self.context_window = []
    
    async def process_audio_chunk(self, audio, timestamp):
        # 1. Speech-to-text with diarization
        result = await self.stt.transcribe(
            audio,
            diarization=True,
            streaming=True
        )
        
        # 2. Speaker identification
        speaker_id = result.speaker_id
        text = result.text
        
        # 3. Add to context
        self.context_window.append({
            "speaker": speaker_id,
            "text": text,
            "timestamp": timestamp
        })
        
        # 4. Trigger analysis on sentence boundaries
        if result.is_final:
            await self.analyze_segment(text, speaker_id)
    
    async def analyze_segment(self, text, speaker):
        # Real-time extraction
        prompts = [
            self.detect_action_items(text),
            self.detect_decisions(text),
            self.detect_questions(text)
        ]
        await asyncio.gather(*prompts)
```

### 3.3 Speaker Diarization

Critical for multi-speaker meeting transcription:

**Providers:**
| Provider | Real-time | Accuracy | Overlap Handling |
|----------|-----------|----------|------------------|
| **Deepgram** | Yes | High | Good |
| **Gladia** | Yes | High | Good (100+ languages) |
| **pyannote.ai** | Yes | Very High | Excellent |
| **Azure Speech** | Yes | Good | Moderate |
| **AssemblyAI** | Near-real-time | High | Good |

**Technical Approach:**
1. **Voice Activity Detection (VAD)**: Identify speech segments
2. **Speaker Embedding**: Extract voice characteristics per segment
3. **Clustering**: Group segments by speaker identity
4. **Overlap detection**: Handle simultaneous speakers

**Source**: [Deepgram Speaker Diarization](https://deepgram.com/learn/what-is-speaker-diarization)

---

## 4. Turn-Taking in Multi-Party Conversations

### 4.1 The Floor Management Problem

In multi-party AI conversations, coordinating who speaks when is critical:

**Challenges:**
- Multiple participants may want to speak simultaneously
- AI agents need clear signals for when to respond
- Interruptions must be handled gracefully
- Context must flow correctly to all participants

### 4.2 OVON Framework: Floor-Shared Conversational Space

The Open Voice Interoperability Initiative (OVON) provides a specification for multi-agent conversations:

#### Key Concepts

**Floor**: Virtual space serving as common ground for all agents
- Holds shared context and conversation history
- Mechanisms for agents to access/contribute to collective knowledge

**Floor Manager**: Controls message routing
- Determines which messages sent to which participants
- Enforces policies on who has the floor
- Manages contextual information

**Convener Agent**: Central coordinator for conversational dynamics
- Processes floor requests from agents
- Grants or revokes floor access
- Handles priority when multiple agents request simultaneously

#### Message Protocol Examples

**Floor Request:**
```json
{
  "ovon": {
    "conversation": {"id": "session123"},
    "sender": {"from": "https://agent1.example.com"},
    "events": [
      {
        "to": "https://convener.example.com",
        "eventType": "Floor_request",
        "parameters": {
          "request_reason": "interjection"
        }
      }
    ]
  }
}
```

**Floor Grant:**
```json
{
  "ovon": {
    "conversation": {"id": "session123"},
    "sender": {"from": "https://convener.example.com"},
    "events": [
      {
        "to": "https://agent1.example.com",
        "eventType": "Floor_grant",
        "parameters": {
          "duration_ms": 60000,
          "context": {
            "previous_speaker_id": "agent2",
            "topic": "travel planning"
          }
        }
      }
    ]
  }
}
```

**Source**: [OVON Multi-Agent Interoperability](https://arxiv.org/html/2411.05828v1)

### 4.3 Voice Activity Detection (VAD) for Turn Detection

**Common Approach**: Pause-based turn detection
- VAD model classifies audio as speech/non-speech
- Long pause (typically 0.8s) signals turn end
- User can then be responded to

**Configuration Parameters:**
```python
VAD_STOP_SECS = 0.8    # Pause length for end of turn
VAD_START_SECS = 0.2   # Speech length to trigger start
VAD_CONFIDENCE = 0.7   # Classification confidence threshold
VAD_MIN_VOLUME = 0.6   # Minimum volume for speech
```

**Limitations:**
- People pause mid-thought
- Individual speaking styles vary
- Short pauses may incorrectly trigger responses

### 4.4 Context-Aware Turn Detection

**Semantic VAD** (OpenAI Realtime API feature):
- Uses context to determine turn boundaries
- Understands filler words ("um", "uh") as continued speech
- Recognizes grammatical patterns

**Smart Turn Detection** (Pipecat):
- Native audio model trained on turn-taking patterns
- Considers intonation, pacing, pronunciation
- Open-source model with training data available

```python
# Context-aware turn detection pipeline (Pipecat pattern)
pipeline = Pipeline([
    transport.input(),
    vad,
    audio_accumulator,
    ParallelPipeline(
        [
            # Turn detection branch
            classifier_llm,
            completeness_check,
        ],
        [
            # Greedy inference branch  
            conversation_llm,
            output_gate,  # Blocked until turn detected
        ],
    ),
    tts,
    transport.output(),
])
```

### 4.5 Interruption Handling

**Barge-in**: User interrupts AI while it's speaking

**Requirements:**
- Every pipeline component must be cancellable
- Audio playout must stop immediately on client
- Context must reflect what user actually heard

**Spurious Interruption Sources:**
1. Transient noises classified as speech
2. Echo cancellation failures
3. Background speech from environment

**Mitigation Strategies:**
- Adjust VAD start segment length
- Apply exponential smoothing to audio volume
- Use speaker isolation (e.g., Krisp) for background speech

### 4.6 Multi-Agent Turn-Taking Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Agent Session                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Convener / Floor Manager               │    │
│  │  - Maintains participant queue                      │    │
│  │  - Processes floor requests                         │    │
│  │  - Enforces turn-taking policies                    │    │
│  └────────────────────────────────────────────────────┘    │
│         ↕              ↕              ↕              ↕      │
│    ┌────────┐    ┌────────┐    ┌────────┐    ┌────────┐   │
│    │ User 1 │    │ User 2 │    │Agent A │    │Agent B │   │
│    │        │    │        │    │(Flight)│    │(Hotel) │   │
│    └────────┘    └────────┘    └────────┘    └────────┘   │
│                                                              │
│  Floor State:                                                │
│  - current_speaker: "Agent A"                               │
│  - queue: ["User 1", "Agent B"]                             │
│  - shared_context: {travel_dates, destination, ...}         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Implementation Recommendations

### 5.1 Technology Stack

| Layer | Recommended | Alternatives |
|-------|-------------|--------------|
| **Transport** | LiveKit (WebRTC) | Daily, Twilio |
| **Agent Framework** | Pipecat | LiveKit Agents, custom |
| **STT** | Deepgram | Gladia, AssemblyAI |
| **LLM** | GPT-4o, Gemini 2.0 Flash | Claude (higher latency) |
| **TTS** | Cartesia, ElevenLabs | Deepgram, Rime |
| **Diarization** | Deepgram, pyannote | Azure Speech |

### 5.2 Latency Budget

Target: **800ms voice-to-voice** for conversational feel

| Component | Budget (ms) |
|-----------|-------------|
| Audio capture/encoding | 60 |
| Network round-trip | 50 |
| STT + endpointing | 300 |
| LLM TTFT | 350 |
| TTS TTFT | 120 |
| Audio decode/playback | 55 |
| **Total** | ~935ms |

### 5.3 Multi-User Session Design

1. **Room-based architecture**: Use SFU for media routing
2. **Speaker identification**: Enable diarization from session start
3. **Shared context**: Maintain unified conversation history accessible to all
4. **Floor management**: Implement request/grant protocol for AI responses
5. **Graceful interruption**: Support barge-in with context repair

### 5.4 Meeting Assistant Checklist

- [ ] Multi-platform bot support (Zoom, Teams, Meet)
- [ ] Real-time transcription with <500ms latency
- [ ] Speaker diarization with labeling
- [ ] Streaming summarization (periodic updates)
- [ ] Action item extraction
- [ ] Post-meeting artifacts (notes, recordings, search)

---

## 6. Sources

### Primary Sources
1. [Voice AI & Voice Agents: An Illustrated Primer](https://voiceaiandvoiceagents.com/) - Comprehensive guide to voice AI architecture
2. [Google Developers Blog: Real-time Bidirectional Streaming Multi-agent System](https://developers.googleblog.com/en/beyond-request-response-architecting-real-time-bidirectional-streaming-multi-agent-system/) - ADK architecture
3. [OVON Multi-Agent Interoperability Extension](https://arxiv.org/html/2411.05828v1) - Floor management specification
4. [LiveKit: Scaling WebRTC with Distributed Mesh](https://blog.livekit.io/scaling-webrtc-with-distributed-mesh/) - Multi-home architecture
5. [Pipecat LiveKit Transport Documentation](https://docs.pipecat.ai/server/services/transport/livekit)

### Additional Sources
- [Deepgram Speaker Diarization](https://deepgram.com/learn/what-is-speaker-diarization)
- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [LiveKit Agents Examples](https://github.com/livekit/agents)
- [Microsoft Teams Copilot](https://support.microsoft.com/en-us/office/use-copilot-in-microsoft-teams-meetings)
- [Azure Real-time Diarization](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-started-stt-diarization)

---

## 7. Confidence Assessment

| Topic | Confidence | Notes |
|-------|------------|-------|
| Multi-user voice architecture | High | Well-documented, production implementations exist |
| Floor management protocols | Medium-High | OVON emerging standard, practical implementations vary |
| Meeting assistant patterns | High | Mature market with established players |
| Voice + whiteboard integration | Medium | Emerging area, limited native integrations |
| Turn-taking in multi-party | Medium-High | Active research, multiple approaches |

**Information Freshness**: Research conducted January 2026. Voice AI field evolving rapidly - verify current capabilities with providers.

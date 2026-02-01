# Voice + Amplifier Project Glossary

> **Version:** 1.0 | **Last Updated:** January 2026

A comprehensive reference of terminology used in the voice + Amplifier project, covering OpenAI Realtime API, WebRTC, Voice AI, Amplifier concepts, and audio/speech terms.

---

## Table of Contents

1. [OpenAI Realtime API Concepts](#1-openai-realtime-api-concepts)
2. [WebRTC Terminology](#2-webrtc-terminology)
3. [Voice AI Terms](#3-voice-ai-terms)
4. [Amplifier Concepts](#4-amplifier-concepts)
5. [Audio and Speech Terms](#5-audio-and-speech-terms)
6. [Acronyms Quick Reference](#6-acronyms-quick-reference)

---

## 1. OpenAI Realtime API Concepts

### Core API Terms

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **Realtime API** | OpenAI's API for low-latency, bidirectional voice communication that processes audio directly without intermediate transcription steps. | "The Realtime API enables native speech-to-speech conversations, unlike traditional STT→LLM→TTS pipelines." |
| **gpt-realtime** | The GA (Generally Available) model optimized for real-time voice conversations. Replaced `gpt-4o-realtime-preview`. | `model: "gpt-realtime"` in session configuration |
| **gpt-realtime-mini** | A smaller, faster, and cheaper variant of gpt-realtime, approximately 3-5x less expensive. | "Use gpt-realtime-mini for cost-sensitive applications where quality tradeoffs are acceptable." |
| **Ephemeral Token** | A short-lived authentication token (~60 seconds) used by browser clients to establish WebRTC connections without exposing API keys. | "The server generates an ephemeral token via `/v1/realtime/sessions`, which the client uses to connect." |
| **client_secret** | The field in the session response containing the ephemeral token value. | `const ephemeralKey = response.client_secret.value;` |
| **Session** | A single conversation instance with the Realtime API, limited to 60 minutes (GA) or 30 minutes (beta). | "Create a new session when the previous one expires to continue the conversation." |
| **Conversation Item** | A discrete piece of content in the conversation context (message, function call, or function result). | "Use `conversation.item.create` to inject messages or tool results into the conversation." |
| **Modalities** | The input/output modes supported in a session: `text`, `audio`, or both. | `modalities: ["text", "audio"]` enables both text and voice interaction. |

### Events

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **Client Event** | An event sent from the client to the OpenAI server (9 total types). | "Send `session.update` client event to configure voice and tools." |
| **Server Event** | An event sent from the OpenAI server to the client (28+ types). | "Listen for `response.audio.delta` server events to receive audio chunks." |
| **session.update** | Client event to configure session settings including instructions, voice, VAD, and tools. | "Always send `session.update` immediately after connection to configure the assistant." |
| **session.created** | Server event indicating the session is ready for use. | "Wait for `session.created` before sending configuration updates." |
| **response.create** | Client event to explicitly request the model to generate a response. **Required** after sending tool results. | "After sending `function_call_output`, you must send `response.create` or the model won't respond." |
| **response.cancel** | Client event to stop an in-progress response, typically used during interruptions. | "When user interrupts, send `response.cancel` to halt audio generation." |
| **response.done** | Server event indicating the complete response has been generated. | "Wait for `response.done` before sending another `response.create`." |
| **response.audio.delta** | Server event containing a chunk of generated audio (base64 encoded). | "Stream `response.audio.delta` chunks directly to the audio player for low latency." |
| **response.audio_transcript.delta** | Server event containing a chunk of the transcript of the model's spoken response. | "Display `response.audio_transcript.delta` text as the assistant speaks." |
| **response.function_call_arguments.done** | Server event indicating a tool call is ready to be executed. | "When `response.function_call_arguments.done` fires, parse the arguments and execute the tool." |
| **conversation.item.create** | Client event to add content to the conversation (messages, tool results). | "Inject tool results using `conversation.item.create` with type `function_call_output`." |
| **conversation.item.truncate** | Client event to trim an assistant response to match what was actually heard. Critical after interruptions. | "Send `conversation.item.truncate` with `audio_end_ms` to sync context after interruption." |
| **input_audio_buffer.append** | Client event to send audio data (used in WebSocket mode). | "In manual VAD mode, continuously send audio via `input_audio_buffer.append`." |
| **input_audio_buffer.commit** | Client event to finalize the audio buffer (manual VAD mode only). | "After user releases push-to-talk, send `input_audio_buffer.commit`." |
| **input_audio_buffer.speech_started** | Server event indicating VAD detected user speech. | "Show a visual indicator when `input_audio_buffer.speech_started` fires." |
| **input_audio_buffer.speech_stopped** | Server event indicating VAD detected end of user speech. | "After `input_audio_buffer.speech_stopped`, model will begin generating response." |

### Tool Calling

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **Function Call** | A request from the model to execute a tool/function with specific arguments. | "The model made a function call to `get_weather` with location 'San Francisco'." |
| **function_call_output** | The conversation item type for returning tool execution results to the model. | `item: { type: "function_call_output", call_id: "...", output: JSON.stringify(result) }` |
| **call_id** | Unique identifier linking a function call to its result. Must match exactly. | "Use the exact `call_id` from the function call event when sending the result." |
| **tool_choice** | Setting that controls when the model calls tools: `auto`, `required`, `none`, or specific function. | "Use `tool_choice: 'auto'` - setting `required` causes infinite loops." |
| **Tool Definition** | JSON Schema describing a function's name, description, and parameters. | "Include clear descriptions in tool definitions to guide when the model should call them." |

### Context Management

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **Context Window** | The maximum tokens the model can consider (32K for GA models). | "Monitor context usage - approaching 32K tokens may cause truncation." |
| **Truncation** | Automatic removal of old conversation content when context limits are reached. | "Configure `retention_ratio: 0.8` to keep 80% of context when truncation occurs." |
| **Prompt Caching** | Automatic caching of system instructions and tool definitions for 90% cost savings on repeated content. | "Prompt caching makes repeated conversations significantly cheaper." |
| **Hosted Prompts** | Pre-configured prompts stored on OpenAI servers, referenced by ID. | "Use hosted prompts for consistent instructions across sessions." |

---

## 2. WebRTC Terminology

### Core Concepts

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **WebRTC** | Web Real-Time Communication - browser API for peer-to-peer audio/video streaming without plugins. | "WebRTC provides lower latency than WebSocket for browser-based voice applications." |
| **RTCPeerConnection** | The main WebRTC interface for establishing and managing connections. | `const pc = new RTCPeerConnection();` |
| **Data Channel** | A bidirectional channel for sending arbitrary data alongside media streams. | "OpenAI uses a data channel named 'oai-events' for JSON event exchange." |
| **SDP (Session Description Protocol)** | A format for describing multimedia session parameters including codecs, addresses, and capabilities. | "Exchange SDP offer/answer to establish the WebRTC connection." |
| **SDP Offer** | The initial session description sent by the connection initiator. | "Client creates SDP offer, sends to server, receives SDP answer." |
| **SDP Answer** | The response session description that completes the negotiation. | "OpenAI's SDP answer contains ICE candidates for the audio connection." |
| **ICE (Interactive Connectivity Establishment)** | Protocol for finding the best path between peers, handling NAT traversal. | "OpenAI provides ICE candidates directly - no STUN/TURN configuration needed." |
| **ICE Candidate** | A potential network path (IP address and port) for establishing the connection. | "OpenAI's SDP includes 6 ICE candidates across 3 Azure endpoints." |

### Connection States

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **ICE Connection State** | The status of ICE connectivity: `new`, `checking`, `connected`, `disconnected`, `failed`, `closed`. | "Monitor `iceConnectionState` - reconnect if it reaches 'failed'." |
| **Connection State** | The overall connection status: `new`, `connecting`, `connected`, `disconnected`, `failed`, `closed`. | "Only send events when `connectionState === 'connected'`." |
| **ICE Gathering State** | The status of candidate collection: `new`, `gathering`, `complete`. | "Wait for ICE gathering to complete before finalizing the offer." |

### Network Terms

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **STUN** | Session Traversal Utilities for NAT - server that helps discover public IP. Not required for OpenAI. | "OpenAI handles NAT traversal server-side, so STUN servers aren't needed." |
| **TURN** | Traversal Using Relays around NAT - relay server for when direct connection fails. Not required for OpenAI. | "No TURN server costs - OpenAI handles relay internally." |
| **NAT Traversal** | Techniques for establishing connections through Network Address Translation devices. | "WebRTC handles NAT traversal automatically through ICE." |
| **Host Candidate** | An ICE candidate using the device's local IP address (what OpenAI provides). | "OpenAI uses host candidates only - direct connection to Azure endpoints." |
| **Trickle ICE** | Incrementally sharing ICE candidates as they're discovered rather than all at once. | "GA API supports trickle ICE (no end-of-candidates marker)." |

### Media Handling

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **MediaStream** | A stream of media content (audio and/or video tracks). | `const stream = await navigator.mediaDevices.getUserMedia({ audio: true });` |
| **MediaStreamTrack** | A single media track (audio or video) within a stream. | "Add the audio track to the peer connection: `pc.addTrack(stream.getTracks()[0])`" |
| **getUserMedia** | Browser API to access microphone and camera. | "Request microphone permission with `navigator.mediaDevices.getUserMedia()`." |
| **ontrack** | Event fired when a remote media track is received. | `pc.ontrack = (e) => audioElement.srcObject = e.streams[0];` |

---

## 3. Voice AI Terms

### Voice Activity Detection (VAD)

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **VAD (Voice Activity Detection)** | System that detects when a user is speaking vs. silent. | "VAD determines when to end user's turn and trigger model response." |
| **Server VAD** | OpenAI's default VAD using audio energy and silence detection. | `turn_detection: { type: "server_vad", threshold: 0.5 }` |
| **Semantic VAD** | Advanced VAD using AI to understand when user has finished their thought. | "Semantic VAD waits for conceptual completion, not just silence." |
| **Threshold** | Sensitivity setting for classifying audio as speech (0.0-1.0, higher = less sensitive). | "Increase threshold to 0.7 in noisy environments to reduce false positives." |
| **Silence Duration** | How long to wait after speech stops before ending turn (ms). | "Set `silence_duration_ms: 500` for production (minimum recommended)." |
| **Prefix Padding** | Amount of audio captured before detected speech starts (ms). | "Use `prefix_padding_ms: 300` to avoid clipping initial phonemes." |
| **Eagerness** | Semantic VAD setting controlling response speed: `low`, `medium`, `high`, `auto`. | "Use `eagerness: 'low'` for interviews where users need think time." |
| **Turn Detection** | The overall system for detecting when speaker turns change. | "Disable turn detection (`null`) for push-to-talk interfaces." |

### Conversation Concepts

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **Turn** | A single speaker's contribution before the other party speaks. | "User turn ends when VAD detects silence, triggering model's turn." |
| **Barge-in / Interruption** | When user starts speaking while model is still responding. | "Enable `interrupt_response: true` to allow natural barge-in." |
| **Turn-taking** | The protocol for switching between speakers in conversation. | "Natural turn-taking requires proper VAD tuning and interruption handling." |
| **Idle Timeout** | Automatic prompt when user is silent for extended period. | "Set `idle_timeout_ms: 6000` to prompt user after 6 seconds of silence." |
| **Time-to-First-Byte (TTFB)** | Latency from end of user speech to start of model audio. | "Target TTFB under 500ms for natural conversation feel." |
| **Voice-to-Voice Latency** | Total time from user finishing speaking to hearing model response. | "Good voice-to-voice latency is under 800ms; acceptable is under 1200ms." |

### Voice Characteristics

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **Voice** | The specific speech synthesis personality/character used by the model. | "Choose from: alloy, ash, ballad, coral, echo, sage, shimmer, verse, marin, cedar." |
| **Voice Lock** | Restriction that voice cannot be changed once audio has been emitted in a session. | "Voice is locked after first audio - set it in session creation." |
| **Prosody** | The rhythm, stress, and intonation patterns in speech. | "The model naturally varies prosody based on emotional content." |

---

## 4. Amplifier Concepts

### Core Architecture

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **Amplifier** | Microsoft's AI agent framework providing tools, context, and orchestration for AI assistants. | "Amplifier provides the tool execution layer for the voice assistant." |
| **Amplifier Foundation** | The core library for programmatic Amplifier integration. | `from amplifier_foundation.bundle import load_bundle` |
| **Bundle** | A packaged collection of tools, hooks, and configurations. | "Load the `amplifier-dev` bundle for development tool access." |
| **AmplifierBridge** | The integration layer connecting voice model to Amplifier tool execution. | "AmplifierBridge maintains a long-lived session for tool calls." |
| **Coordinator** | The Amplifier component that orchestrates tool execution. | "Call tools directly via `coordinator.call_tool(name, arguments)`." |
| **Session** | An Amplifier execution context with state, tools, and working directory. | "Create one Amplifier session at server startup, reuse for all voice calls." |

### Tools

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **Tool** | A function that Amplifier agents can execute (file ops, bash, web, etc.). | "The `task` tool delegates complex work to specialist agents." |
| **Tool Mount** | The runtime instance of a tool ready for execution. | "Execute via `tool_mount.call(**arguments)` for direct invocation." |
| **Tool Registry** | Collection of all available tools in a session. | "Extract tools from `coordinator._tools` for voice model configuration." |
| **tool-filesystem** | Tool bundle for file operations (read, write, edit). | "Voice can use tool-filesystem to read code files." |
| **tool-bash** | Tool for executing shell commands. | "Delegate bash commands through task tool for safety." |
| **tool-web** | Tool for web search and page fetching. | "Use tool-web for real-time information queries." |
| **tool-search** | Tool for code search (grep, glob). | "Search codebase with tool-search before making changes." |
| **tool-task** | Tool that spawns specialist AI agents for complex work. | "Voice delegates complex tasks via `task` tool to Amplifier agents." |

### Agents

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **Agent** | A specialized AI persona with specific capabilities and instructions. | "The `code-reviewer` agent analyzes code for issues." |
| **Specialist Agent** | An agent focused on a specific domain (security, testing, architecture). | "Delegate security review to `security-guardian` specialist agent." |
| **Task Delegation** | Pattern where voice model routes work to Amplifier agents via task tool. | "Voice understands intent, then delegates execution to appropriate agent." |
| **Orchestrator** | Component (voice or agent) that coordinates work across multiple agents. | "Voice acts as thin orchestrator, routing to specialist agents." |

### Integration Patterns

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **Tiered Tool Exposure** | Pattern of exposing simple tools directly to voice, delegating complex ones. | "Tier 1: read_file (direct), Tier 3: bash (delegate via task)." |
| **Context Synchronization** | Keeping voice and Amplifier sessions aligned on current state. | "Sync conversation summaries and active files between voice and Amplifier." |
| **Session Bridging** | Maintaining task continuity across voice session reconnects. | "Persist running tasks so they survive voice session timeout." |
| **Progressive Updates** | Streaming task progress back to voice during long operations. | "Voice says 'Still working...' with progress updates from Amplifier." |

---

## 5. Audio and Speech Terms

### Audio Formats

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **PCM (Pulse Code Modulation)** | Uncompressed digital audio format representing waveform amplitude. | "OpenAI Realtime uses PCM16 at 24kHz for highest quality." |
| **PCM16** | 16-bit PCM audio with signed integers, little-endian byte order. | "Default format: 24kHz sample rate, 16-bit, mono, little-endian." |
| **G.711** | Telephony audio codec standard at 8kHz sample rate. | "Use `g711_ulaw` for US telephony, `g711_alaw` for international." |
| **mu-law (μ-law)** | Companding algorithm used in North American telephony (G.711 variant). | `input_audio_format: "g711_ulaw"` for Twilio integration. |
| **A-law** | Companding algorithm used in European telephony (G.711 variant). | "A-law provides similar quality to mu-law for E1 systems." |
| **Opus** | Modern audio codec optimized for speech and music, used in WebRTC. | "Browser WebRTC connections use Opus codec automatically." |
| **Sample Rate** | Number of audio samples per second (Hz). | "24,000 Hz (24kHz) is the native rate for OpenAI Realtime." |
| **Bit Depth** | Number of bits per audio sample (affects dynamic range). | "16-bit depth provides 96dB dynamic range, sufficient for speech." |
| **Mono** | Single-channel audio (vs. stereo). | "Voice applications use mono audio - stereo adds no value." |
| **Bitrate** | Data rate of audio stream (bits per second). | "PCM16 at 24kHz = ~384 kbps uncompressed, ~500 kbps base64." |

### Audio Processing

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **Echo Cancellation (AEC)** | Processing that removes speaker output from microphone input. | "Use Chrome or Safari for best built-in echo cancellation." |
| **Noise Suppression** | Processing that reduces background noise from audio. | "Consider RNNoise or Krisp for noisy environments." |
| **FEC (Forward Error Correction)** | Redundant data added to recover from packet loss. | "Opus uses `useinbandfec=1` for packet loss resilience." |
| **Jitter** | Variation in packet arrival times causing audio irregularity. | "Monitor jitter in chrome://webrtc-internals - target under 30ms." |
| **Packet Loss** | Network packets that fail to arrive, causing audio gaps. | "WebRTC handles packet loss gracefully - UDP skips late packets." |
| **Latency** | Delay between audio generation and playback. | "Bluetooth audio adds 100-300ms latency - avoid for voice apps." |

### Speech Processing

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **STT (Speech-to-Text)** | Converting spoken audio to written text (transcription). | "Traditional pipelines use STT→LLM→TTS; Realtime API is native." |
| **TTS (Text-to-Speech)** | Converting written text to spoken audio (synthesis). | "The Realtime API includes native TTS - no separate service needed." |
| **ASR (Automatic Speech Recognition)** | System that transcribes speech (synonymous with STT). | "ASR accuracy varies with accent, background noise, and audio quality." |
| **Transcription** | The text output of speech recognition. | "Enable `input_audio_transcription` to get user speech as text." |
| **Speech-to-Speech** | Direct audio-in, audio-out processing without text intermediary. | "OpenAI's native speech-to-speech reduces latency and preserves nuance." |
| **Input Audio Transcription** | Server-side transcription of user speech (can lag 1-3 seconds). | `input_audio_transcription: { model: "gpt-4o-mini-transcribe" }` |
| **Transcript Delta** | An incremental chunk of transcription text. | "Display `audio_transcript.delta` events for real-time captions." |

### Voice Synthesis

| Term | Definition | Context/Usage Example |
|------|------------|----------------------|
| **Neural TTS** | AI-based speech synthesis using neural networks for natural-sounding output. | "OpenAI's voices use neural TTS for human-like prosody." |
| **Voice Cloning** | Creating a synthetic voice that mimics a specific person. | "Custom voice cloning is not currently available in Realtime API." |
| **Phoneme** | The smallest unit of sound in speech. | "Prefix padding prevents clipping initial phonemes." |
| **Utterance** | A complete spoken phrase or sentence. | "VAD groups audio into utterances for processing." |

---

## 6. Acronyms Quick Reference

| Acronym | Full Term | Category |
|---------|-----------|----------|
| **AEC** | Acoustic Echo Cancellation | Audio Processing |
| **API** | Application Programming Interface | General |
| **ASR** | Automatic Speech Recognition | Speech Processing |
| **DTLS** | Datagram Transport Layer Security | WebRTC |
| **FEC** | Forward Error Correction | Audio |
| **GA** | Generally Available | API Status |
| **ICE** | Interactive Connectivity Establishment | WebRTC |
| **LLM** | Large Language Model | AI |
| **NAT** | Network Address Translation | Networking |
| **PCM** | Pulse Code Modulation | Audio |
| **RTC** | Real-Time Communication | WebRTC |
| **SCTP** | Stream Control Transmission Protocol | WebRTC |
| **SDP** | Session Description Protocol | WebRTC |
| **SIP** | Session Initiation Protocol | Telephony |
| **SRTP** | Secure Real-time Transport Protocol | WebRTC |
| **STT** | Speech-to-Text | Speech Processing |
| **STUN** | Session Traversal Utilities for NAT | WebRTC |
| **TCP** | Transmission Control Protocol | Networking |
| **TPM** | Tokens Per Minute | API Limits |
| **TTFB** | Time to First Byte | Performance |
| **TTS** | Text-to-Speech | Speech Processing |
| **TURN** | Traversal Using Relays around NAT | WebRTC |
| **UDP** | User Datagram Protocol | Networking |
| **VAD** | Voice Activity Detection | Voice AI |
| **WebRTC** | Web Real-Time Communication | Protocol |

---

## Document Conventions

- **Bold terms** in tables are the primary entry
- *Italics* indicate related terms or alternatives
- `code formatting` shows exact API values or code usage
- Definitions aim to be self-contained without requiring other glossary entries

---

*This glossary is maintained as part of the voice + Amplifier project documentation. For detailed technical specifications, see the research documents in `/research/findings/` and `/research/brainstorms/`.*

# Voice AI Debugging Techniques

## Research Summary

Voice AI debugging requires a multi-layered diagnostic approach spanning network/telephony, audio/ASR, intelligence/LLM, and output/TTS. Industry analysis of 1M+ production voice agent calls reveals that 50%+ of issues originate in infrastructure or audio layers, not in LLM logic. Effective debugging demands component-level isolation, structured logging with correlation IDs, and production-grade observability with OpenTelemetry tracing.

---

## 1. Debugging Framework: The Four-Layer Approach

### Layer Priority (Debug in Order)

| Layer | What to Check | Key Tools | Production Thresholds |
|-------|---------------|-----------|----------------------|
| **1. Telephony/Network** | ICE connection, STUN/TURN, firewall | chrome://webrtc-internals, Wireshark | ICE state: "connected", RTT <150ms |
| **2. Audio/ASR** | Codec, WebRTC, VAD, transcription | webrtc-internals, ASR logs | Packet loss <1%, jitter <20ms, ASR confidence >0.85 |
| **3. Intelligence/LLM** | Intent recognition, prompts, context | Component traces, LLM logs | Response <1s, no 429 errors |
| **4. Output/TTS** | Synthesis latency, audio encoding | TTS service metrics | TTFB <200ms |

**Critical Rule**: Start at the infrastructure layer. Move up only when that layer is verified working.

---

## 2. Common Failure Patterns

### Quick Symptom Lookup

| Symptom | Likely Cause | Layer | First Check |
|---------|--------------|-------|-------------|
| ICE state stuck on "checking" | Firewall blocking UDP | Network | Open UDP ports 3478, 5349, 10000-60000 |
| No audio either direction | Media connection failed | Network | STUN/TURN configuration |
| One-way audio | Asymmetric NAT/firewall | Network | Check inbound/outbound packets |
| Choppy/robotic voice | Packet loss or jitter | Audio | RTP stats in webrtc-internals |
| 2-5 second response delay | STT endpointing or LLM queuing | Pipeline | Component-level traces |
| Agent doesn't stop when interrupted | Barge-in detection issue | Audio | VAD threshold settings |
| Agent cuts off user mid-sentence | Aggressive endpointing | Audio | Silence threshold (target 400-600ms) |
| Wrong responses or timeouts | LLM endpoint issues | Intelligence | Check for 429 errors, prompt drift |
| Empty transcripts | No audio reaching ASR | Audio | Check audio frames in logs |

### Failure Cascade Patterns

Single root-cause errors propagate through the pipeline:

```
Network latency → ASR timeouts → LLM timeouts → Call drops
ASR garbage → LLM hallucination → Wrong tool calls → User frustration
LLM slow → Turn-taking broken → Users talk over agent
TTS slow → User thinks agent died → Premature hangup
```

---

## 3. Audio Quality Diagnostics

### Network Quality Metrics

| Metric | Excellent | Good | Acceptable | Poor | AI Agent Impact |
|--------|-----------|------|------------|------|-----------------|
| **Packet Loss** | <0.5% | <1% | <3% | >5% | ASR misses words, sentences cut off |
| **Jitter** | <10ms | <20ms | <50ms | >50ms | Audio distortion, robotic voice |
| **RTT (Latency)** | <50ms | <100ms | <200ms | >300ms | Conversation delays, overlapping speech |
| **MOS Score** | >4.3 | >4.0 | >3.5 | <3.0 | User/agent audio quality degrades |

**Critical**: A 2% packet loss that's "acceptable" for human calls causes 10-15% ASR word error rate increases for voice agents.

### Browser-Based Debugging

**Chrome WebRTC Internals** (`chrome://webrtc-internals`):
1. Open BEFORE starting the voice agent session
2. Start the call - connection data populates automatically
3. Check:
   - ICE candidate pairs and connection state
   - Inbound/outbound RTP statistics
   - Audio track statistics

**Key Sections to Monitor**:

| Section | What to Look For |
|---------|------------------|
| ICE Candidate Pairs | Selected pair should show "succeeded" |
| Inbound RTP (audio) | packetsLost, jitter, roundTripTime |
| Outbound RTP (audio) | packetsSent, bytesSent |
| Connection State | Should reach "connected" or "completed" |

### RTP Statistics Collection (Programmatic)

```javascript
// Collect RTP statistics every 2 seconds
setInterval(async () => {
  const stats = await peerConnection.getStats();
  stats.forEach(report => {
    if (report.type === 'inbound-rtp' && report.kind === 'audio') {
      console.log('Packets received:', report.packetsReceived);
      console.log('Packets lost:', report.packetsLost);
      console.log('Jitter (ms):', report.jitter * 1000);
    }
    if (report.type === 'remote-inbound-rtp' && report.kind === 'audio') {
      console.log('Round trip time (ms):', report.roundTripTime * 1000);
    }
  });
}, 2000);
```

### Audio Quality Issue Patterns

| Symptom | Likely Cause | Diagnostic | Fix |
|---------|--------------|------------|-----|
| Choppy audio | Packet loss >5% | Check webrtc-internals stats | Improve network, enable FEC |
| Echo/feedback | AEC failure | Test different device/browser | Enable echo cancellation |
| One-way audio | Asymmetric NAT/firewall | Check inbound/outbound packets | Open UDP ports, use TURN |
| Robotic voice | High jitter | Check jitter buffer stats | Increase buffer, improve network |
| Audio cuts out | Network instability | Monitor packet loss patterns | Use wired connection |

---

## 4. Conversation Flow Debugging

### Voice Agent Latency Breakdown

```
User speaks → Audio capture → STT → LLM → TTS → Audio playback
              (~70ms)       (~350ms) (~600-1000ms) (~100ms) (~10ms)
              
Total: ~1.2-1.6s + network hops (~100ms)
Production metrics: P50 ~1.5s, P95 ~5s
```

### Component Latency Targets

| Component | P50 Reality | P95 Reality | Critical Threshold |
|-----------|-------------|-------------|-------------------|
| Audio capture/buffering | 50-70ms | 100-150ms | >200ms |
| STT (TTFB) | 200-250ms | 400-500ms | >800ms |
| STT (final transcript) | 300-350ms | 600-700ms | >1000ms |
| LLM (first token) | 400-600ms | 1500-2000ms | >3000ms |
| LLM (complete) | 600-1000ms | 2000-3000ms | >5000ms |
| TTS (first byte) | 80-100ms | 150-200ms | >400ms |
| TTS (complete) | 100-150ms | 200-300ms | >500ms |

### Turn Detection & VAD Debugging

**Common Issues**:

| Issue | Symptom | Fix |
|-------|---------|-----|
| False-positive interruptions | Agent starts speaking while user pauses | Increase silence threshold to 600-800ms |
| Slow response | Agent waits too long to respond | Lower end_of_turn_confidence_threshold |
| Cuts off user | Agent interrupts mid-sentence | Use semantic turn detection, not just VAD |
| Doesn't respond | Agent never detects end of turn | Check VAD is receiving audio, lower max_turn_silence |

**Recommended Turn Detection Settings**:

```javascript
// Aggressive - Fast customer service (IVR, confirmations)
{
  "end_of_turn_confidence_threshold": 0.3,
  "min_end_of_turn_silence_when_confident": 160,
  "max_turn_silence": 800
}

// Balanced - Natural conversations (default)
{
  "end_of_turn_confidence_threshold": 0.4,
  "min_end_of_turn_silence_when_confident": 400,
  "max_turn_silence": 1280
}

// Conservative - Complex instructions (medical, legal)
{
  "end_of_turn_confidence_threshold": 0.5,
  "min_end_of_turn_silence_when_confident": 560,
  "max_turn_silence": 2000
}
```

### Barge-In and Interruption Handling

**Debugging Steps**:
1. Verify VAD is detecting user speech during agent playback
2. Check if audio ducking/stopping is triggered
3. Measure time from user speech detection to agent silence
4. Target: <500ms barge-in response time

---

## 5. ASR (Speech Recognition) Debugging

### ASR Error Types

| Error Type | Example | Root Cause | Diagnostic Check |
|------------|---------|------------|------------------|
| Accent variation | "async" → "ask key" | Regional pronunciation | Test with accent datasets |
| Background noise | Random word insertions | Poor microphone, artifacts | Check audio quality scores |
| Code-mixed speech | Mixed language confusion | Multiple languages | Enable multilingual ASR |
| Low confidence | Names, numbers wrong | Critical utterance issues | Log confidence scores |
| Truncation | Sentences cut off | Aggressive endpointing | Check silence threshold |

### ASR Diagnostic Checklist

1. **Audio reaching server?** Check for audio frames in logs, verify WebRTC connection
2. **Codec negotiated correctly?** Expected: Opus (WebRTC) or PCMU/PCMA (SIP)
3. **ASR returning transcripts?** Empty transcripts = no audio or VAD issue
4. **Confidence scores acceptable?** Target >0.85, investigate <0.7
5. **WER within threshold?** Target <5% clean audio, <10% with noise
6. **Provider status?** Check Deepgram, AssemblyAI, Google STT status pages

### Word Error Rate (WER) Analysis

```
WER = (Substitutions + Deletions + Insertions) / Total Words in Reference
```

**Acceptable WER Targets**:
- Clean audio: <5%
- Noisy environment: <10%
- Heavy accent: <15%

---

## 6. LLM Debugging

### LLM Failure Modes

| Failure Mode | Symptoms | Root Cause | Fix |
|--------------|----------|------------|-----|
| Hallucinations | Made-up facts, wrong policies | No grounding in verified data | Add RAG validation, lower temperature |
| Misclassified intent | Wrong action triggered | Ambiguous user input, poor NLU | Improve prompt, add disambiguation |
| Context overflow | Forgets earlier details | Token limit exceeded | Implement summarization, truncation |
| Cascading errors | Multiple wrong decisions | Single root mistake propagates | Add validation checkpoints |
| Rate limiting | Slow/no responses | 429 errors from provider | Implement backoff, upgrade tier |
| Prompt drift | Inconsistent behavior | Recent prompt changes | Version control prompts, A/B test |

### LLM Diagnostic Checklist

1. **LLM endpoint responding?** Direct API test, check provider status
2. **Rate limiting?** Look for 429 errors, check tokens per minute
3. **Prompt changes?** Review recent deployments, check for injection
4. **Context window?** Calculate tokens per conversation, approaching limit?
5. **Tool calls working?** Check function call logs, tool timeout errors
6. **Response quality?** Compare to baseline, check for hallucinations

---

## 7. Logging and Observability

### Essential Logging Schema (Per Turn)

```json
{
  "call_id": "call_abc123",
  "turn_index": 3,
  "timestamp": "2026-01-31T12:00:00Z",
  "user_transcript": "I need to reschedule my appointment",
  "asr_confidence": 0.94,
  "intent": {"name": "reschedule_appointment", "confidence": 0.91},
  "latency_ms": {
    "stt": 180,
    "llm": 420,
    "tts": 150,
    "total": 750
  },
  "tool_calls": [{"name": "get_appointments", "success": true, "latency_ms": 85}],
  "agent_response": "I can help you reschedule..."
}
```

### Turn-Level Metrics to Track

```javascript
const turnMetrics = {
  // Audio
  userSpeechStart: null,      // VAD detects speech
  userSpeechEnd: null,        // VAD detects silence (endpointing)
  
  // STT
  sttRequestStart: null,      // Audio sent to STT
  sttFirstPartial: null,      // First partial transcript received
  sttFinalTranscript: null,   // Final transcript received
  
  // LLM
  llmRequestStart: null,      // Prompt sent to LLM
  llmFirstToken: null,        // First token received
  llmComplete: null,          // Full response received
  
  // TTS
  ttsRequestStart: null,      // Text sent to TTS
  ttsFirstByte: null,         // First audio byte received
  ttsComplete: null,          // Full audio received
  
  // Playback
  audioPlaybackStart: null,   // Audio playback begins
};
```

### Production Monitoring Alerts

| Metric | What It Measures | Alert Threshold |
|--------|------------------|-----------------|
| Call success rate | Calls completing without errors | Alert if <95% |
| P95 end-to-end latency | Worst-case response time | Alert if >5s |
| ASR confidence | Transcription quality | Alert if avg <0.8 |
| Task completion | Goal achievement rate | Alert if <85% |
| Error rate | Failed calls/total calls | Alert if >0.2% |

### OpenTelemetry Integration

Use distributed tracing across components:
- Create parent span for entire call
- Child spans for each component (ASR, LLM, TTS)
- Attach correlation IDs across services
- Log latency, errors, and metadata on each span

---

## 8. Testing Strategies

### Automated Testing Checklist

- [ ] End-to-end latency tests (simulate real calls)
- [ ] ASR accuracy tests (various accents, noise levels)
- [ ] LLM response quality tests (intent recognition, hallucination detection)
- [ ] TTS quality tests (pronunciation, naturalness)
- [ ] Barge-in handling tests (interruption scenarios)
- [ ] Network degradation tests (packet loss, jitter simulation)
- [ ] Load tests (concurrent call capacity)

### Regression Testing

Convert production failures into regression tests:
1. Capture original audio and timing
2. Store expected intent and response
3. Replay through pipeline
4. Compare results to expected outcomes

### Synthetic Test Call Patterns

```
- Happy path: Clean audio, simple request, expected response
- Noisy environment: Background noise, music, cross-talk
- Accent variations: Regional accents, non-native speakers
- Edge cases: Long pauses, interruptions, corrections
- Error recovery: Network drops, timeout handling
```

---

## 9. Common Tools

### Open Source Debugging Tools

| Tool | Purpose |
|------|---------|
| chrome://webrtc-internals | WebRTC connection debugging |
| Wireshark | Packet capture and RTP analysis |
| webrtc-issue-detector | Real-time WebRTC diagnostics |
| Silero VAD | Voice activity detection |
| Whisper | ASR accuracy testing |

### Network Analysis Commands

```bash
# Capture STUN/TURN traffic
wireshark -f "udp port 3478 or udp port 5349 or tcp port 443"

# Capture RTP traffic
tcpdump -i any -w voip_capture.pcap udp portrange 10000-20000

# Test STUN connectivity
stun stun.l.google.com:19302

# DNS lookup for SIP
dig SRV _sip._udp.provider.com
```

---

## 10. Quick Reference: Diagnostic Thresholds

### Production Quality Targets

| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| End-to-end latency (P50) | <1.5s | <3s | >5s |
| End-to-end latency (P95) | <5s | <8s | >10s |
| ASR confidence | >0.85 | >0.7 | <0.7 |
| Packet loss | <0.5% | <1% | >2% |
| Jitter | <15ms | <30ms | >50ms |
| MOS score | >4.0 | >3.5 | <3.5 |
| LLM first token | <600ms | <1s | >2s |
| TTS TTFB | <200ms | <400ms | >500ms |
| Barge-in response | <500ms | <800ms | >1s |

---

## Sources

1. Hamming AI - "Debug WebRTC Voice Agents: Complete Checklist & Troubleshooting Guide" (Jan 2026)
   - https://hamming.ai/resources/debug-webrtc-voice-agents-troubleshooting-guide

2. Hamming AI - "Voice Agent Troubleshooting: Complete Diagnostic Checklist" (Jan 2026)
   - https://hamming.ai/resources/voice-agent-troubleshooting

3. Cresta - "Engineering for Real-Time Voice Agent Latency" (Oct 2025)
   - https://cresta.com/blog/engineering-for-real-time-voice-agent-latency

4. AIMultiple - "Top 7 Speech Recognition Challenges & Solutions" (Aug 2025)
   - https://research.aimultiple.com/speech-recognition-challenges/

5. AssemblyAI - "Best Practices for Building Voice Agents" (2026)
   - https://www.assemblyai.com/docs/voice-agent-best-practices

6. Microsoft Azure - "How to collect diagnostic audio recordings"
   - https://learn.microsoft.com/en-us/azure/communication-services/resources/troubleshooting/voice-video-calling/references/how-to-collect-diagnostic-audio-recordings

---

**Confidence Level**: High - Information sourced from industry leaders actively deploying production voice agents at scale (1M+ calls analyzed).

**Gaps**: 
- Limited information on debugging specific voice AI platforms (Retell, VAPI, Bland) - each has proprietary logging
- On-premise/self-hosted debugging patterns less documented than cloud-based solutions
- Emerging voice-to-voice models (not cascaded STT→LLM→TTS) have limited debugging tooling

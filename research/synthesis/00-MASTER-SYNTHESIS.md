# Voice + Amplifier Research Synthesis

**Generated:** 2026-01-31
**Research Scope:** OpenAI Realtime API + Amplifier Integration

---

## Executive Summary

This research explores building a voice-first AI interface that combines OpenAI's Realtime Voice API (WebRTC-based, low-latency, real-time speech-to-speech) with Amplifier (a powerful modular AI agent framework). The key insight is that this combination enables capabilities **impossible with traditional voice assistants**: fire-and-forget background tasks, multi-agent coordination, persistent memory across sessions, real code execution, and file system access.

The OpenAI Realtime API reached **General Availability in August 2025** with the `gpt-realtime` model offering 32K token context, 60-minute sessions, and ~500ms time-to-first-audio latency. The critical technical challenge is managing the handoff between the fast-but-limited voice model and the powerful-but-slower Amplifier backend.

Our unique value proposition: **Voice as a delegation interface to an entire team of AI specialists**, not just a query interface to a single model.

---

## Quick Reference Card

| Metric | Value |
|--------|-------|
| **Model** | `gpt-realtime` (GA) or `gpt-4o-realtime-preview` |
| **Context Window** | 32K tokens (practical), 128K (theoretical) |
| **Session Limit** | 60 minutes (hard limit, not extendable) |
| **Target Latency** | <800ms voice-to-voice |
| **Audio Format** | PCM16, 24kHz, mono |
| **Pricing** | ~$0.30/min baseline, can reach $1.20/min with context accumulation |
| **Best Voices** | `marin`, `cedar` (GA optimized) |
| **VAD Options** | `server_vad` (silence-based), `semantic_vad` (intent-based) |
| **Reconnection** | NOT possible - must create new session with context injection |

### Critical Technical Facts

1. **Tool calling requires TWO steps**: `conversation.item.create` (tool result) AND `response.create` (trigger response)
2. **`tool_choice: "required"` is bugged** - causes infinite loops; use `"auto"` with strong prompting
3. **Always truncate on interruption** - `conversation.item.truncate` keeps context accurate
4. **Context costs accumulate** - entire history sent each turn; implement summarization
5. **No session resume** - must save state externally for reconnection

---

## Implementation Priorities

### Phase 1: MVP (Week 1-2)
**Goal:** Demonstrate core value proposition

| Priority | Feature | Rationale |
|----------|---------|-----------|
| P0 | Tiered tool exposure | Instant responses for simple queries |
| P0 | Pre-action announcements | Users know what's happening |
| P0 | Basic task delegation | Show Amplifier's power |
| P1 | Connection health monitoring | Reliability foundation |
| P1 | Error handling UX | Graceful failures |

### Phase 2: Quick Wins (Week 2-3)
| Priority | Feature | Rationale |
|----------|---------|-----------|
| P0 | Async task execution | Fire-and-forget differentiator |
| P0 | State persistence | Survive disconnects |
| P1 | Progress updates | Keep users informed |
| P1 | Session rotation | Handle 60-min limit |

### Phase 3: Differentiation (Week 4-6)
| Priority | Feature | Rationale |
|----------|---------|-----------|
| P0 | Background task completion | Unique capability |
| P0 | Multi-agent coordination | Complex workflows |
| P1 | Persistent memory | Cross-session continuity |
| P1 | Proactive notifications | Amplifier informs voice |

---

## Critical Technical Decisions

### 1. Tool Exposure Strategy
```
TIER 1 (Voice-direct, <500ms): read_file, glob, grep, web_search
TIER 2 (Confirmed, ~1s): write_file, edit_file  
TIER 3 (Delegated, async): task, bash, complex operations
```

### 2. Context Management
- Summarize at 80% of 32K token limit
- Use SYSTEM role for summaries (not ASSISTANT)
- Delete old conversation items after summarization
- Enable `truncation: "auto"` for automatic management

### 3. Session Lifecycle
- Prepare handoff at 55 minutes (5-min buffer)
- Save conversation state to file/database
- On reconnect: inject summary as system message
- Track task state separately from voice session

### 4. Tool Call Flow (THE CORRECT SEQUENCE)
```
1. response.function_call_arguments.done  (OpenAI wants to call tool)
2. Extract call_id and arguments
3. Execute tool
4. conversation.item.create (type: "function_call_output", call_id, output)
5. response.create  ← CRITICAL: Without this, conversation stalls!
6. Wait for response.done
```

---

## Unique Value Propositions

### What We Can Do That Others Cannot

| Capability | Alexa/Siri/Google | ChatGPT Voice | Amplifier+Voice |
|------------|-------------------|---------------|-----------------|
| Fire-and-forget tasks | ❌ | ❌ | ✅ |
| Real file system access | ❌ | ❌ | ✅ |
| Code execution | ❌ | ❌ | ✅ |
| Multi-agent delegation | ❌ | ❌ | ✅ |
| Persistent cross-session memory | Limited | ❌ | ✅ |
| Background monitoring | Limited | ❌ | ✅ |
| Complex multi-step workflows | ❌ | Limited | ✅ |

### Killer Demo Scenarios

1. **"Research competitors and write a report"** → User goes to lunch → Returns to completed report
2. **"Build me a Python script that does X"** → Voice creates, tests, and saves working code
3. **"Monitor my build and tell me when it's done"** → Proactive notification on completion
4. **"Continue where we left off yesterday"** → Seamless cross-session continuity

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 60-min session timeout | High | High | Session rotation with context preservation |
| Tool call reliability | Medium | High | Strong prompting, `"auto"` mode, retry logic |
| Context overflow | High | Medium | Automatic summarization, pruning |
| Network disconnects | Medium | Medium | State persistence, reconnection flow |
| Cost accumulation | High | Medium | Context pruning, `gpt-realtime-mini` for simple tasks |
| Corporate firewalls | Medium | Low | WebSocket fallback, TCP on port 443 |

---

## Open Questions

1. **Optimal summarization frequency** - How often to summarize without disrupting flow?
2. **Voice/Amplifier context sync** - Best pattern for keeping both aligned?
3. **Proactive notification timing** - When should Amplifier interrupt voice?
4. **Multi-user scenarios** - How to handle different users on same device?
5. **Cost optimization at scale** - What's the true cost per minute in production?

---

## Research Document Index

### Brainstorms (Ideas & Patterns)
| File | Content | Ideas |
|------|---------|-------|
| 01-ux-interaction-ideas.md | UX patterns, conversation design | 70+ |
| 02-technical-api-capabilities.md | API capabilities, technical questions | 109 |
| 03-amplifier-integration-patterns.md | Integration architectures | 60+ |
| 04-unique-differentiators.md | Competitive advantages | 105 |
| 05-implementation-roadmap.md | Prioritized roadmap | - |
| 06-edge-cases-failure-modes.md | Error handling, resilience | 60+ |
| 07-demo-scenarios.md | Demo scripts | 41 |
| 08-prompt-engineering-strategies.md | Prompt templates | - |
| 09-visual-ui-components.md | UI specifications | - |
| 10-data-flow-architecture.md | Architecture diagrams | - |

### Research Findings (Facts & Best Practices)
| File | Topic |
|------|-------|
| 01-openai-realtime-api-official-docs.md | Official API documentation |
| 02-tool-calling-best-practices.md | Tool/function calling patterns |
| 03-context-management-patterns.md | Context window management |
| 04-session-management-patterns.md | Session lifecycle, reconnection |
| 05-vad-and-audio-settings.md | Voice activity detection |
| 06-latency-optimization.md | Performance optimization |
| 07-conversation-design-patterns.md | Prompt engineering for voice |
| 08-competitor-landscape.md | LiveKit, Vapi, Retell, etc. |
| 09-multimodal-capabilities.md | Image/video support |
| 10-pricing-and-optimization.md | Costs, rate limits |
| 11-security-privacy-compliance.md | HIPAA, GDPR, SOC2 |
| 12-webrtc-implementation-details.md | WebRTC technical details |
| 13-telephony-integration.md | Twilio, SIP, PSTN |
| 14-testing-debugging-strategies.md | Testing methodologies |
| 15-accessibility-considerations.md | Inclusive design |
| 16-analytics-and-metrics.md | KPIs, measurement |
| 17-mcp-integration.md | Model Context Protocol |
| 18-interruption-handling.md | Barge-in, turn-taking |
| 19-personalization-preferences.md | User preferences, memory |
| 21-emotion-sentiment.md | Emotional intelligence |
| 22-voice-cloning-customization.md | Custom voices |
| 23-enterprise-deployment.md | Scale, HA, compliance |
| 24-audio-quality-accuracy.md | WER, noise handling |
| 25-realtime-transcription.md | Live transcription |

### Synthesis Documents
| File | Purpose |
|------|---------|
| 00-MASTER-SYNTHESIS.md | This document - start here |
| 01-TECHNICAL-QUICK-REFERENCE.md | Developer cheat sheet |
| 02-UX-DESIGN-GUIDE.md | Voice UX patterns |

---

## Next Steps

1. **Read this document** for strategic overview
2. **Reference Technical Quick Reference** while coding
3. **Use UX Design Guide** for interaction design
4. **Dive into specific findings** as needed
5. **Review demo scenarios** for feature prioritization

---

*This synthesis represents ~25 research documents, 400+ ideas, and comprehensive coverage of the voice + Amplifier integration space.*

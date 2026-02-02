# Implementation Roadmap: Amplifier Voice Integration

> **Date**: 2026-01-31
> **Context**: Prioritized roadmap for building voice-first Amplifier integration
> **Current State**: Voice model has only `task` tool delegating to Amplifier agents

---

## Executive Summary

This roadmap prioritizes building the most **impressive and differentiating** voice assistant possible, given:
- OpenAI Realtime API (60-min sessions, ~500ms latency, WebRTC)
- Amplifier's multi-agent framework with rich tool ecosystem
- Current architecture: Voice → task tool → Amplifier agents

**Strategic Insight**: Our differentiation isn't doing the same things better—it's enabling things that were previously **impossible** with voice assistants.

---

## Phase 1: MVP (Week 1-2)

### Goal: Demonstrate Core Value Proposition
*"Voice commands that actually DO things in the real world"*

### 1.1 Tiered Tool Exposure ⭐ HIGHEST PRIORITY

**Current**: Voice → task → Amplifier (always delegating, high latency)
**Target**: Voice can directly execute simple tools for instant responses

```python
TIER_1_INSTANT = {
    "read_file": "Read files instantly",
    "glob": "Find files by pattern", 
    "grep": "Search file contents",
    "web_search": "Search the web"
}  # Voice executes directly (~500ms)

TIER_2_CONFIRMED = {
    "write_file": "Write with confirmation",
    "edit_file": "Edit with preview"
}  # Voice confirms, then executes (~1s)

TIER_3_DELEGATED = {
    "task": "Complex multi-step work",
    "bash": "Command execution"
}  # Always delegate to Amplifier agents
```

**Implementation**:
1. Create voice-optimized tool wrappers with sensible defaults
2. Expose Tier 1 tools directly to OpenAI session
3. Keep `task` for complex operations

**Effort**: 2-3 days
**Impact**: 10x faster responses for simple queries
**Risk**: Low - additive, doesn't break existing flow

---

### 1.2 Voice-Friendly Result Summarization

**Problem**: Amplifier returns detailed results; voice needs concise summaries

```python
SUMMARY_TEMPLATES = {
    "file_read": "The file {name} has {lines} lines. {key_content}",
    "search": "Found {count} matches. Top results: {top_3}",
    "code_change": "Modified {file}: {change_summary}",
    "error": "That didn't work: {reason}. Try: {suggestion}"
}

def summarize_for_voice(result, max_words=50):
    """Convert tool output to speakable summary"""
    if result.type in SUMMARY_TEMPLATES:
        return SUMMARY_TEMPLATES[result.type].format(**result.data)
    return llm_summarize(result, max_words)
```

**Implementation**:
1. Add result summarizers for each tool type
2. Implement length-based truncation
3. Add progressive disclosure ("Want more details?")

**Effort**: 1-2 days
**Impact**: Natural conversational flow
**Risk**: Low

---

### 1.3 Basic Progress Feedback

**Problem**: Long operations leave user in silence

```python
# During tool execution
voice.speak("Let me check that for you...")  # Pre-announcement
# ... tool executes ...
voice.speak("Found it. Here's what I see...")  # Result

# For longer operations (>3s)
voice.speak("This might take a moment. Working on it...")
```

**Implementation**:
1. Add pre-announcement to tool descriptions
2. Implement timeout-based progress messages
3. Track operation duration estimates

**Effort**: 1 day
**Impact**: Reduces perceived latency significantly
**Risk**: Low

---

### 1.4 Demo Scenarios

Create 3-5 compelling demos that showcase the unique value:

| Demo | What It Shows | Wow Factor |
|------|---------------|------------|
| "Read my config file" | Instant file access | Speed |
| "Find all TODO comments in src" | Code search | Practical |
| "Search the web for X, summarize" | Web + synthesis | Capability |
| "Create a Python script that..." | Code generation + execution | Magic |
| "Analyze this codebase for security issues" | Deep agent work | Power |

**Effort**: 2 days
**Impact**: Critical for stakeholder buy-in

---

## Phase 2: Quick Wins (Week 2-3)

### 2.1 Async Task Execution with Notifications

**The Killer Differentiator**: Fire-and-forget tasks

```python
# User: "Run a security audit on my codebase"
task_id = await task_async("security-reviewer", instruction)
voice.speak("I've started the security audit. I'll let you know when it's done.")

# ... User does other things ...

# When complete (could be minutes later)
on_complete(task_id, lambda r: voice.speak(f"Security audit complete. Found {r.issues} issues."))
```

**Implementation**:
1. Create async task registry that survives voice session
2. Implement completion notification queue
3. Add "What's the status of my task?" query handler

**Effort**: 3-4 days
**Impact**: Enables 10+ minute background operations
**Risk**: Medium - requires session state management

---

### 2.2 Conversation Context Persistence

**Problem**: Voice session dies → context lost

```python
class ConversationState:
    """Survives voice session disconnects"""
    conversation_summary: str
    active_files: List[str]
    recent_changes: List[Change]
    pending_tasks: List[Task]
    user_preferences: Dict

# On session end
save_state(session_id, state)

# On reconnect
voice.speak(f"Welcome back. You were working on {state.active_files[0]}. "
            f"You have {len(state.pending_tasks)} tasks running.")
```

**Implementation**:
1. Define ConversationState schema
2. Auto-save on session events
3. Restore on reconnection

**Effort**: 2-3 days
**Impact**: Continuity across sessions
**Risk**: Low

---

### 2.3 Intelligent Error Handling

**Problem**: Tool errors kill conversation flow

```python
ERROR_TRANSLATIONS = {
    "FileNotFoundError": "I couldn't find that file. Should I search for similar files?",
    "PermissionError": "I don't have permission to access that. Is it protected?",
    "TimeoutError": "That's taking longer than expected. Should I keep trying?",
    "SyntaxError": "There's a syntax error at line {line}. Want me to try to fix it?"
}

async def handle_tool_error(error, context):
    friendly_message = translate_error(error)
    suggestions = get_recovery_suggestions(error, context)
    voice.speak(f"{friendly_message} {suggestions}")
```

**Effort**: 2 days
**Impact**: Graceful degradation
**Risk**: Low

---

### 2.4 Session Timeout Handling

**Problem**: 60-minute hard limit, no resume capability

```python
class SessionManager:
    def __init__(self, max_duration=55*60):  # 55 min (5 min buffer)
        self.start_time = None
        
    def check_timeout(self):
        remaining = self.max_duration - (time.time() - self.start_time)
        if remaining < 5*60:  # 5 min warning
            self.prepare_rotation()
            
    async def prepare_rotation(self):
        summary = await self.summarize_conversation()
        voice.speak("Heads up, I'll need to refresh our connection in a few minutes. "
                   "Don't worry, I'll remember what we were working on.")
        
    async def rotate_session(self):
        new_session = await create_session_with_context(self.summary)
        await self.handoff(new_session)
```

**Effort**: 2-3 days
**Impact**: Seamless long sessions
**Risk**: Medium - timing critical

---

## Phase 3: Technical Foundations (Week 3-4)

### 3.1 Robust Tool Call Flow

**Critical**: OpenAI's Realtime API requires specific event sequence

```
function_call_arguments.done → conversation.item.create → response.create
                                  (MUST send both!)
```

**Implementation**:
1. Centralized tool execution handler
2. Proper error propagation (always return string, even on error)
3. Multiple tool call batching
4. Response.cancel for interruptions

```python
async def handle_tool_call(event):
    try:
        result = await execute_tool(event.name, event.arguments)
        output = summarize_for_voice(result)
    except Exception as e:
        output = json.dumps({"error": str(e), "suggestion": get_suggestion(e)})
    
    # Step 1: Send result (REQUIRED)
    await send_event({
        "type": "conversation.item.create",
        "item": {
            "type": "function_call_output",
            "call_id": event.call_id,
            "output": output
        }
    })
    
    # Step 2: Trigger response (REQUIRED!)
    await send_event({"type": "response.create"})
```

**Effort**: 2-3 days
**Impact**: Reliability foundation
**Risk**: Low but critical

---

### 3.2 Context Window Management

**Problem**: 32K context fills up fast with audio (~800 tokens/minute)

```python
class ContextManager:
    MAX_TOKENS = 28000  # Leave room for response
    
    async def manage_context(self, current_tokens):
        if current_tokens > self.MAX_TOKENS * 0.8:  # 80% threshold
            await self.summarize_and_prune()
    
    async def summarize_and_prune(self):
        old_turns = self.history[:-KEEP_LAST_N]
        summary = await summarize_with_cheap_model(old_turns)
        
        # Insert summary at conversation root
        await send_event({
            "type": "conversation.item.create",
            "previous_item_id": "root",
            "item": {
                "type": "message",
                "role": "system",  # Use system, not assistant!
                "content": [{"type": "input_text", "text": summary}]
            }
        })
        
        # Delete old items
        for turn in old_turns:
            await send_event({
                "type": "conversation.item.delete",
                "item_id": turn.item_id
            })
```

**Effort**: 3-4 days
**Impact**: Enables longer conversations
**Risk**: Medium - summarization quality critical

---

### 3.3 Shared State Between Voice and Amplifier

```python
class SharedContext:
    """Bridge between Voice model and Amplifier agents"""
    
    # Voice → Amplifier
    def inject_voice_context(self, agent_instruction: str) -> str:
        return f"""
        Recent conversation: {self.summarize_last_turns(5)}
        Files discussed: {self.active_files}
        User preferences: {self.preferences}
        
        Task: {agent_instruction}
        """
    
    # Amplifier → Voice
    def format_agent_result(self, result: AgentResult) -> str:
        return f"""
        Agent completed: {result.summary}
        Files modified: {result.files_changed}
        Key findings: {result.highlights}
        """
```

**Effort**: 2-3 days
**Impact**: Better agent delegation
**Risk**: Low

---

### 3.4 Comprehensive Logging & Observability

```python
class VoiceMetrics:
    # Latency tracking
    tool_execution_times: Dict[str, List[float]]
    voice_response_times: List[float]
    
    # Quality tracking
    error_rates: Dict[str, float]
    user_corrections: int
    successful_completions: int
    
    # Cost tracking
    audio_tokens_in: int
    audio_tokens_out: int
    text_tokens: int
    
    def estimate_session_cost(self):
        # With caching: ~$0.40/1M cached, $32/1M uncached audio
        ...
```

**Effort**: 2 days
**Impact**: Debugging and optimization
**Risk**: Low

---

## Phase 4: UX Excellence (Week 4-5)

### 4.1 Interruptible Operations

**User says "stop" mid-operation**:

```python
@voice_command("stop", "cancel", "that's enough")
async def handle_interruption():
    if current_task:
        partial = await current_task.cancel_and_get_partial()
        voice.speak(f"Stopped. Here's what I had so far: {partial}")
    else:
        voice.speak("Nothing running right now.")
```

**Effort**: 2 days
**Impact**: User control
**Risk**: Low

---

### 4.2 Progressive Disclosure Pattern

```python
async def present_results(results):
    # First: Brief summary
    voice.speak(brief_summary(results))
    
    # Then: Offer more
    voice.speak("Want the details?")
    
    # User: "Yes" / "Tell me more"
    if await wait_for_affirmation():
        voice.speak(detailed_summary(results))
        
        # Even more available
        voice.speak("I can also show you the raw data if you'd like.")
```

**Effort**: 2 days
**Impact**: Matches conversation style
**Risk**: Low

---

### 4.3 Voice Personas & Adaptation

```python
PERSONAS = {
    "professional": {
        "tone": "concise, direct",
        "verbosity": "minimal",
        "confirmations": "brief"
    },
    "friendly": {
        "tone": "warm, conversational",
        "verbosity": "explanatory",
        "confirmations": "encouraging"
    }
}

# Adapt based on user behavior
if user_prefers_brief_responses():
    voice.set_persona("professional")
```

**Effort**: 2-3 days
**Impact**: Personalization
**Risk**: Low

---

### 4.4 Multi-Modal Feedback (Voice + UI)

```python
class MultiModalResponse:
    voice_summary: str      # Spoken aloud
    ui_detail: Dict         # Shown in transcript
    code_preview: str       # Highlighted in editor
    
# Example: Code change
response = MultiModalResponse(
    voice_summary="I've added input validation to the login function.",
    ui_detail={"diff": diff_output, "file": "auth.py"},
    code_preview=highlighted_code
)
```

**Effort**: 3-4 days (requires frontend work)
**Impact**: Rich experience
**Risk**: Medium - cross-component coordination

---

## Phase 5: Differentiation (Week 5-6)

### 5.1 Long-Running Background Tasks

**The "Impossible" Feature**: Tasks that outlive voice sessions

```python
class PersistentTaskManager:
    """Tasks survive voice disconnect"""
    
    async def start_background_task(self, agent, instruction):
        task = Task(
            id=uuid4(),
            agent=agent,
            instruction=instruction,
            status="running",
            voice_session_id=current_session.id
        )
        
        # Save to persistent storage
        await self.store.save(task)
        
        # Execute in background
        asyncio.create_task(self.execute_and_notify(task))
        
        return task.id
    
    async def execute_and_notify(self, task):
        try:
            result = await amplifier.execute(task.agent, task.instruction)
            task.result = result
            task.status = "complete"
        except Exception as e:
            task.error = str(e)
            task.status = "failed"
        
        await self.store.save(task)
        await self.notification_queue.push(task)
    
    async def check_notifications(self, voice_session_id):
        """Called when voice reconnects"""
        pending = await self.notification_queue.get_for_session(voice_session_id)
        return pending
```

**Use Cases**:
- "Run a full security audit" (20+ minutes)
- "Refactor all files to use async" (10+ minutes)
- "Research competitor pricing" (web crawling, 30+ minutes)

**Effort**: 4-5 days
**Impact**: **MASSIVE** - enables entire category of impossible operations
**Risk**: Medium - state management complexity

---

### 5.2 Multi-Agent Orchestration via Voice

```python
# User: "I need to refactor the auth system"
async def complex_task_orchestration():
    # Voice assembles the team
    voice.speak("I'll coordinate a team for this. Let me get the architect, "
               "security reviewer, and implementation agent working together.")
    
    # Phase 1: Planning
    plan = await task("architect", "Design auth system refactor")
    voice.speak(f"Architect recommends: {plan.summary}. Sound good?")
    
    # User approves
    
    # Phase 2: Security review of plan
    security_review = await task("security-reviewer", f"Review this plan: {plan}")
    voice.speak(f"Security says: {security_review.summary}")
    
    # Phase 3: Implementation (parallel)
    voice.speak("Starting implementation. I'll update you on progress.")
    results = await asyncio.gather(
        task_async("builder", "Implement auth changes"),
        task_async("test-writer", "Write tests for auth")
    )
    
    voice.speak("Done! Code is written and tested. Want me to create a PR?")
```

**Effort**: 4-5 days
**Impact**: Showcases full Amplifier power
**Risk**: Medium

---

### 5.3 Persistent Memory & Learning

```python
class UserMemory:
    """Long-term memory across all sessions"""
    
    preferences: Dict[str, Any]  # "prefers tabs", "likes verbose errors"
    patterns: List[Pattern]       # "always runs tests before commit"
    corrections: List[Correction] # Learning from mistakes
    
    async def learn_from_correction(self, original, correction):
        self.corrections.append(Correction(original, correction))
        voice.speak(f"Got it, you meant {correction}. I'll remember that.")
    
    async def suggest_automation(self, pattern):
        voice.speak(f"I notice you always {pattern.description}. "
                   f"Should I do that automatically?")
```

**Effort**: 3-4 days
**Impact**: Feels like a real assistant
**Risk**: Low

---

### 5.4 Proactive Intelligence

```python
# Anomaly detection
@monitor("error_rates")
async def detect_anomaly(metric, value):
    if value > threshold:
        voice.interject("I noticed error rates spiking. Should I investigate?")

# Opportunity identification
@periodic(hours=24)
async def daily_insights():
    insights = await analyze_codebase_for_improvements()
    if insights:
        queue_for_next_session(insights)

# Context-aware preparation
@on_calendar_event("meeting")
async def prepare_for_meeting(event):
    if "code review" in event.title.lower():
        changes = await get_recent_changes()
        summary = await summarize_changes(changes)
        queue_notification(f"For your code review: {summary}")
```

**Effort**: 5-6 days
**Impact**: **Magical** - feels anticipatory
**Risk**: Medium - requires external integrations

---

## Scaling Considerations

### What Will Break at Scale

| Component | Break Point | Mitigation |
|-----------|-------------|------------|
| Amplifier sessions | Memory per session | Session pooling, eviction |
| Background tasks | Too many concurrent | Task queue with limits |
| Context storage | Disk/memory | TTL, compression, archival |
| OpenAI costs | $1.14+ per exchange | Caching, tier optimization |
| WebRTC connections | Server resources | Load balancing |

### Architecture for Scale

```
                    Load Balancer
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    Voice Server 1  Voice Server 2  Voice Server N
         │               │               │
         └───────────────┼───────────────┘
                         │
              ┌──────────┴──────────┐
              │   Shared Services   │
              │  - Task Registry    │
              │  - State Store      │
              │  - Notification Q   │
              └─────────────────────┘
                         │
              ┌──────────┴──────────┐
              │  Amplifier Workers  │
              │  (Horizontal Scale) │
              └─────────────────────┘
```

---

## Risk Mitigation

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Session timeout mid-task | High | Medium | Checkpoint, graceful handoff |
| Tool execution >30s | Medium | High | Async pattern, progress updates |
| Context overflow | Medium | High | Summarization, pruning |
| WebRTC in corporate networks | Medium | Medium | WebSocket fallback |
| OpenAI API rate limits | Low | High | Request queuing, backoff |

### UX Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| User speaks during tool exec | High | Low | Clear state indicators |
| Misunderstood intent | Medium | Medium | Confirmation for destructive ops |
| Long silence during work | High | High | Progress updates, pre-announcements |
| Lost context on reconnect | Medium | High | Persistent state, summaries |

---

## Integration Priority Matrix

### Which Amplifier Capabilities to Expose First

| Capability | Voice Value | Implementation Effort | Priority |
|------------|-------------|----------------------|----------|
| File reading/search | **High** - instant answers | Low | **P0** |
| Web search | **High** - knowledge access | Low | **P0** |
| Task delegation | **High** - complex work | Already done | **P0** |
| File writing/editing | **High** - make changes | Medium | **P1** |
| Code execution (bash) | Medium - risky | Medium | **P2** |
| Multi-agent workflows | **Very High** - differentiation | High | **P2** |
| Background monitoring | **Very High** - impossible elsewhere | High | **P3** |
| Integrations (git, APIs) | Medium | High | **P3** |

---

## Success Metrics

### MVP Success (Week 2)
- [ ] 5+ tools directly executable via voice
- [ ] <2s response time for simple queries
- [ ] 3 compelling demo scenarios working
- [ ] Error handling doesn't break conversation

### Phase 2 Success (Week 4)
- [ ] Background tasks survive voice disconnect
- [ ] Session timeout handled gracefully
- [ ] Context persists across reconnections
- [ ] User can ask "what's running?"

### Phase 3 Success (Week 6)
- [ ] 60-minute sessions without issues
- [ ] Multi-agent workflows via voice
- [ ] Persistent user preferences
- [ ] Cost per session tracked and optimized

### Differentiation Success
- [ ] Demo features impossible in Alexa/Siri/ChatGPT voice
- [ ] Users say "I didn't know voice could do that"
- [ ] Background task completion rate >95%

---

## Recommended Build Order

```
Week 1: MVP Foundation
├── Day 1-2: Tiered tool exposure (Tier 1 direct tools)
├── Day 3-4: Result summarization + pre-announcements
└── Day 5: Demo scenarios

Week 2: Quick Wins
├── Day 1-2: Async task registry
├── Day 3-4: Conversation state persistence
└── Day 5: Error handling polish

Week 3: Technical Hardening
├── Day 1-2: Robust tool call flow
├── Day 3-4: Context window management
└── Day 5: Session timeout handling

Week 4: UX Excellence
├── Day 1-2: Interruptible operations
├── Day 3-4: Progressive disclosure
└── Day 5: Multi-modal feedback (voice + UI)

Week 5-6: Differentiation
├── Day 1-3: Long-running background tasks
├── Day 4-6: Multi-agent orchestration
├── Day 7-8: Persistent memory
└── Day 9-10: Proactive intelligence
```

---

## Open Questions for Decision

1. **Direct writes via voice?** Should voice ever have direct write access, or always delegate?
   - *Recommendation*: Tier 2 with confirmation for simple writes, delegate for complex

2. **Persona selection?** Should users choose persona, or should system adapt?
   - *Recommendation*: Auto-adapt with option to override

3. **Background task limits?** How many concurrent background tasks per user?
   - *Recommendation*: Start with 3, increase based on resource monitoring

4. **Cost visibility?** Should users see cost estimates before expensive operations?
   - *Recommendation*: Yes for tasks >$0.50 estimated cost

5. **Multi-user sessions?** Support for shared sessions (pair programming)?
   - *Recommendation*: Defer to Phase 4+

---

## Conclusion

The implementation roadmap prioritizes:

1. **Speed** - Tiered tools for instant responses
2. **Reliability** - Robust tool flow and error handling  
3. **Continuity** - State persistence and session management
4. **Differentiation** - Background tasks, multi-agent, proactive intelligence

The goal is not incremental improvement over existing voice assistants, but **categorical advancement**—enabling voice interactions that were previously impossible.

**Key Insight**: The Amplifier integration transforms voice from a simple query interface into a **delegation interface to an entire team of AI specialists** that can work autonomously, in the background, for hours.

This is the future of voice computing.

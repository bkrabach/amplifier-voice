# Amplifier Integration Patterns Brainstorm

> **Date**: 2026-01-31
> **Context**: Exploring architectural patterns for integrating OpenAI Realtime Voice API with Amplifier's agent framework
> **Current State**: Voice model has only `task` tool, forcing all work delegation to Amplifier agents

---

## Table of Contents

1. [Tool Exposure Strategies](#1-tool-exposure-strategies)
2. [Agent Orchestration Patterns](#2-agent-orchestration-patterns)
3. [Context Synchronization](#3-context-synchronization)
4. [Task Delegation Patterns](#4-task-delegation-patterns)
5. [Result Summarization](#5-result-summarization)
6. [Multi-Agent Voice Scenarios](#6-multi-agent-voice-scenarios)
7. [Session Bridging](#7-session-bridging)
8. [Capability Discovery](#8-capability-discovery)
9. [Feedback Loops](#9-feedback-loops)
10. [Hierarchical Control](#10-hierarchical-control)
11. [Error Propagation](#11-error-propagation)
12. [Resource Management](#12-resource-management)
13. [Security Boundaries](#13-security-boundaries)
14. [Caching Strategies](#14-caching-strategies)
15. [State Machines](#15-state-machines)
16. [Additional Patterns](#16-additional-patterns)

---

## 1. Tool Exposure Strategies

### 1.1 Current Approach: Task-Only Delegation
```
Voice Model → task tool → Amplifier Agent → [all tools]
```
**Pros**: Clean separation, voice model stays simple, agents have full power
**Cons**: Latency for simple operations, can't leverage voice model's speed

### 1.2 Tiered Tool Exposure
```python
TIER_1_INSTANT = {"web_search", "read_file"}  # Voice executes directly
TIER_2_FAST = {"write_file", "edit_file"}     # Voice with confirmation
TIER_3_COMPLEX = {"bash", "task"}             # Always delegate
```
**Idea**: Expose simple, read-only tools directly to voice for instant responses

### 1.3 Dynamic Tool Surfacing
```python
# Voice asks: "What files are in src/"
# System surfaces glob/read_file temporarily
voice_tools = base_tools + context_relevant_tools(current_task)
```
**Idea**: Dynamically add tools based on conversation context

### 1.4 Tool Facades / Simplified Wrappers
```python
# Instead of exposing full read_file with all options
voice_read_file = {
    "name": "quick_read",
    "description": "Read a file (first 100 lines)",
    "parameters": {"path": "string"}  # Simplified
}
```
**Idea**: Create voice-optimized tool wrappers with sensible defaults

### 1.5 Tool Bundles by Intent
```python
VOICE_BUNDLES = {
    "exploration": ["glob", "grep", "read_file"],
    "modification": ["task"],  # Always delegate writes
    "information": ["web_search", "web_fetch"],
    "execution": ["task"]  # Always delegate
}
```
**Idea**: Pre-defined tool sets that voice can switch between

### 1.6 Read-Only vs Write Mode
```python
# Default: read-only tools exposed
# User says "I want to make changes"
# System: upgrades to include write tools or delegates
```
**Idea**: Mode-based tool availability

### 1.7 Tool Complexity Score
```python
TOOL_COMPLEXITY = {
    "read_file": 1,      # Instant, expose directly
    "web_search": 2,     # Fast, expose directly
    "bash": 8,           # Risky, delegate
    "task": 10           # Complex, always delegate
}
# Expose tools with complexity < threshold
```

### 1.8 Conversation-Phase Tools
```
Phase 1 (Discovery): read-only tools
Phase 2 (Planning): task tool for planning agent
Phase 3 (Execution): task tool for builder agent
Phase 4 (Review): read-only + test tools
```

---

## 2. Agent Orchestration Patterns

### 2.1 Voice as Thin Orchestrator
```
Human ←→ Voice Model ←→ Task Tool ←→ Amplifier Agents
              ↑
        (routing only)
```
**Current approach**: Voice decides WHICH agent, Amplifier does the work

### 2.2 Amplifier as Primary Orchestrator
```
Human ←→ Voice Model ←→ orchestrator-agent ←→ [specialist agents]
              ↑                    ↑
        (voice I/O)        (decision making)
```
**Idea**: Voice is just the human interface, an Amplifier agent makes all decisions

### 2.3 Hybrid Orchestration
```
Simple queries:  Human ←→ Voice (instant)
Complex tasks:   Human ←→ Voice ←→ Amplifier
Meta decisions:  Human ←→ Voice ←→ meta-agent ←→ task routing
```
**Idea**: Voice handles what it can, escalates intelligently

### 2.4 Parallel Agent Execution
```python
# Voice: "Check the tests and review the code"
await asyncio.gather(
    task("test-runner", "run tests"),
    task("code-reviewer", "review changes")
)
# Voice summarizes both results
```

### 2.5 Agent Chains
```
Voice → planner-agent → [plan] → builder-agent → [code] → reviewer-agent → Voice
```
**Idea**: Voice initiates a chain, gets final result

### 2.6 Agent Voting/Consensus
```python
# For critical decisions
results = await asyncio.gather(
    task("security-reviewer", prompt),
    task("code-reviewer", prompt),
    task("architect", prompt)
)
consensus = aggregate_recommendations(results)
```

### 2.7 Supervisor Pattern
```
Voice ←→ supervisor-agent ←→ [worker agents]
              ↑
    (monitors, intervenes, reports)
```
**Idea**: Dedicated supervisor agent that Voice talks to

### 2.8 Reactive Agent Selection
```python
# Based on user's tone/urgency
if user_seems_frustrated:
    agent = "empathetic-helper"
elif user_wants_speed:
    agent = "quick-fixer"
else:
    agent = "thorough-analyzer"
```

---

## 3. Context Synchronization

### 3.1 Shared Context Store
```python
class SharedContext:
    """Persistent context accessible by both Voice and Amplifier"""
    conversation_summary: str
    active_files: List[str]
    recent_changes: List[Change]
    user_preferences: Dict
    current_task: Optional[Task]
```

### 3.2 Context Injection on Delegation
```python
async def delegate_with_context(agent, instruction):
    context = f"""
    Recent conversation: {summarize_last_n_turns(5)}
    Files discussed: {active_files}
    User preferences: {preferences}
    
    Task: {instruction}
    """
    return await task(agent, context)
```

### 3.3 Bidirectional Context Sync
```
Voice Session                    Amplifier Session
     ↓                                 ↓
[conversation] ←─── sync ───→ [working context]
     ↓                                 ↓
[summarize]    ←─── sync ───→ [discoveries]
```

### 3.4 Context Checkpointing
```python
# Every N turns or on significant events
checkpoint = {
    "timestamp": now(),
    "voice_context": voice_session.get_context(),
    "amplifier_state": amplifier_session.get_state(),
    "files_modified": [...],
    "decisions_made": [...]
}
save_checkpoint(checkpoint)
```

### 3.5 Differential Context Updates
```python
# Only sync what changed
delta = compute_context_delta(last_sync, current)
if delta.significant:
    sync_to_amplifier(delta)
```

### 3.6 Context Compression for Voice
```python
# Amplifier has rich context, Voice gets compressed version
voice_context = compress_for_voice(
    amplifier_context,
    max_tokens=2000,
    prioritize=["recent_actions", "key_decisions"]
)
```

### 3.7 File-Based Shared Memory
```
/tmp/voice-session-{id}/
├── context.json          # Shared state
├── conversation.md       # Transcript
├── working_files.txt     # Currently relevant files
└── agent_outputs/        # Results from agents
```

### 3.8 Event-Driven Context Updates
```python
@on_event("file_modified")
def update_context(event):
    shared_context.add_modification(event.file, event.summary)
    notify_voice_model("Context updated: file changed")
```

---

## 4. Task Delegation Patterns

### 4.1 Synchronous Wait (Current)
```python
# Voice waits for result
result = await task(agent, instruction)
voice.speak(summarize(result))
```
**Problem**: Blocking, user waits in silence

### 4.2 Fire-and-Forget with Notification
```python
task_id = await task_async(agent, instruction)
voice.speak("I've started working on that. I'll let you know when it's done.")
# Later...
on_complete(task_id, lambda r: voice.speak(f"Done! {summarize(r)}"))
```

### 4.3 Progressive Updates
```python
async for update in task_stream(agent, instruction):
    if update.type == "progress":
        voice.speak(f"Working on it... {update.message}")
    elif update.type == "complete":
        voice.speak(f"Finished: {summarize(update.result)}")
```

### 4.4 Background with Polling
```python
task_id = start_background_task(agent, instruction)
voice.speak("Working on it in the background.")

# User can ask "how's that task going?"
if user_asks_status:
    status = get_task_status(task_id)
    voice.speak(status.summary)
```

### 4.5 Timeout with Partial Results
```python
try:
    result = await asyncio.wait_for(task(agent, instruction), timeout=30)
except asyncio.TimeoutError:
    partial = get_partial_result(task_id)
    voice.speak(f"Still working, but so far: {partial}")
```

### 4.6 Interruptible Tasks
```python
# User says "stop" or "that's enough"
current_task.cancel()
partial_result = current_task.get_partial()
voice.speak(f"Stopped. Here's what I had: {partial_result}")
```

### 4.7 Task Queuing
```python
task_queue = []
voice.speak("I'll handle these in order:")
for instruction in user_requests:
    task_queue.append(create_task(instruction))
# Process sequentially or with priority
```

### 4.8 Speculative Execution
```python
# Start likely next tasks while voice is responding
if likely_followup := predict_next_task(conversation):
    speculative_task = start_background_task(likely_followup)
    # Cancel if user asks something different
```

### 4.9 Task Dependencies
```python
# "Analyze the code, then write tests for it"
analysis = await task("analyzer", "analyze code")
tests = await task("test-writer", f"write tests based on: {analysis}")
```

### 4.10 Batch Delegation
```python
# Collect related requests, batch them
batch = collect_related_requests(conversation)
results = await task("batch-processor", batch)
```

---

## 5. Result Summarization

### 5.1 Length-Based Summarization
```python
def summarize_for_voice(result, max_words=50):
    if len(result.split()) <= max_words:
        return result
    return llm_summarize(result, max_words)
```

### 5.2 Structured Result Templates
```python
TEMPLATES = {
    "file_read": "The file {name} contains {lines} lines. Key sections: {summary}",
    "code_change": "I modified {file}, changing {what}. The change {impact}.",
    "search": "Found {count} results. Top matches: {top_3}",
    "error": "That didn't work. The issue: {error}. Suggestion: {fix}"
}
```

### 5.3 Confidence-Based Detail
```python
if result.confidence > 0.9:
    voice.speak(f"Done. {brief_summary}")
else:
    voice.speak(f"I think I did it, but you might want to check. {detailed_summary}")
```

### 5.4 User Preference Adaptation
```python
# Track user's preferred verbosity
if user.prefers_brief:
    return one_sentence_summary(result)
elif user.prefers_detailed:
    return full_summary_with_examples(result)
```

### 5.5 Progressive Disclosure
```python
voice.speak(brief_summary)
voice.speak("Want more details?")
if user_says_yes:
    voice.speak(detailed_summary)
```

### 5.6 Modality-Specific Summaries
```python
# Voice gets audio-friendly summary
# UI gets visual representation
voice_summary = "I found 3 security issues in the auth module"
ui_display = {"issues": [...], "severity_chart": {...}}
```

### 5.7 Action-Oriented Summaries
```python
# Focus on what user should do next
summary = f"Done. {what_happened}. Next, you could: {suggestions}"
```

### 5.8 Diff-Style Summaries for Changes
```python
# "I changed login.py: added input validation on lines 45-52, 
#  fixed the SQL injection risk, added logging"
```

### 5.9 Context-Aware Summarization
```python
# If user asked about security, emphasize security aspects
# If user asked about performance, emphasize performance
summary = summarize_with_focus(result, user_focus_area)
```

---

## 6. Multi-Agent Voice Scenarios

### 6.1 Agent Status Dashboard (Voice)
```python
# "What's everyone working on?"
statuses = get_all_agent_statuses()
voice.speak(f"The analyzer is reviewing auth.py. "
            f"The builder is implementing the fix. "
            f"The tester is waiting for the builder.")
```

### 6.2 Agent Handoff Narration
```python
# Voice narrates agent transitions
voice.speak("The planner finished. Handing off to the builder...")
await task("builder", plan)
voice.speak("Builder done. Now the reviewer is checking the work...")
```

### 6.3 Parallel Agent Coordination
```python
# Voice manages multiple simultaneous agents
agents = {
    "frontend": task_async("frontend-dev", "build UI"),
    "backend": task_async("backend-dev", "build API"),
    "tests": task_async("test-writer", "write tests")
}
voice.speak("I've got three agents working in parallel...")
```

### 6.4 Agent Conflict Resolution
```python
# When agents disagree
if architect.recommendation != builder.approach:
    voice.speak("The architect and builder disagree. "
                "Architect suggests X, builder prefers Y. "
                "Which approach would you like?")
```

### 6.5 Specialist Agent Consultation
```python
# Voice can consult specialists without full delegation
quick_answer = await consult("security-expert", "is this pattern safe?")
voice.speak(f"Security says: {quick_answer}")
```

### 6.6 Agent Team Assembly
```python
# "I need to refactor the auth system"
team = assemble_team(["architect", "security-reviewer", "builder", "tester"])
voice.speak(f"I've assembled a team: {team}. Starting with architecture...")
```

### 6.7 Agent Conversation Replay
```python
# "What did the agents discuss?"
dialogue = get_agent_dialogue(task_id)
voice.speak(summarize_agent_conversation(dialogue))
```

---

## 7. Session Bridging

### 7.1 Persistent Task Registry
```python
class TaskRegistry:
    """Survives voice session death"""
    tasks: Dict[str, Task]
    
    def reconnect(self, voice_session_id):
        """Resume tracking for new voice session"""
        return self.get_active_tasks()
```

### 7.2 Session Handoff Protocol
```python
# Voice session ending
handoff = {
    "conversation_summary": summarize(),
    "active_tasks": get_active_tasks(),
    "pending_questions": get_pending(),
    "context_snapshot": get_context()
}
save_handoff(handoff)

# New session
if handoff := load_handoff():
    voice.speak(f"Welcome back. {handoff['summary']}. "
                f"You have {len(handoff['tasks'])} tasks running.")
```

### 7.3 Orphan Task Management
```python
# Tasks that outlive their voice session
class OrphanTaskManager:
    def on_voice_disconnect(self, session_id):
        tasks = get_tasks_for_session(session_id)
        for task in tasks:
            task.orphan = True
            task.save_for_reconnect()
    
    def on_voice_reconnect(self, session_id):
        orphans = get_orphaned_tasks(session_id)
        return orphans  # Voice can resume tracking
```

### 7.4 Notification Queue
```python
# Events while voice disconnected
notification_queue = []

# Agent completes task, voice offline
notification_queue.append({
    "type": "task_complete",
    "task_id": task_id,
    "result_summary": summary
})

# Voice reconnects
for notification in notification_queue:
    voice.speak(notification.to_speech())
```

### 7.5 Checkpoint-Based Recovery
```python
# Regular checkpoints
every_n_minutes(5, lambda: save_checkpoint({
    "voice_state": voice.get_state(),
    "amplifier_state": amplifier.get_state(),
    "tasks": tasks.get_all()
}))

# On reconnect
checkpoint = load_latest_checkpoint()
restore_from_checkpoint(checkpoint)
```

### 7.6 Session Federation
```python
# Multiple voice sessions, one Amplifier backend
class SessionFederation:
    amplifier: AmplifierBridge  # Shared
    voice_sessions: Dict[str, VoiceSession]
    
    def route_event(self, event):
        """Route Amplifier events to correct voice session"""
        session = self.voice_sessions.get(event.session_id)
        if session and session.active:
            session.send(event)
        else:
            self.queue_for_reconnect(event)
```

### 7.7 Graceful Degradation
```python
# Voice dies mid-task
try:
    await task_with_voice_updates(agent, instruction)
except VoiceDisconnected:
    # Continue task, save results for later
    continue_headless(task)
    save_result_for_reconnect(task.result)
```

---

## 8. Capability Discovery

### 8.1 Dynamic Tool Description
```python
# Voice asks "what can you do?"
capabilities = get_all_capabilities()
voice.speak(f"I can {natural_language_list(capabilities)}. "
            f"For complex tasks, I delegate to specialized agents.")
```

### 8.2 Contextual Capability Suggestion
```python
# Based on current conversation
if discussing_code:
    voice.speak("I notice you're working with code. "
                "I can analyze it, find bugs, suggest improvements, "
                "or make changes for you.")
```

### 8.3 Agent Capability Registry
```python
AGENTS = {
    "architect": {
        "capabilities": ["design systems", "review architecture", "plan refactors"],
        "best_for": "high-level design decisions"
    },
    "builder": {
        "capabilities": ["write code", "implement features", "fix bugs"],
        "best_for": "making code changes"
    },
    # ...
}

def suggest_agent(user_intent):
    return best_match(user_intent, AGENTS)
```

### 8.4 Capability Learning
```python
# Track what works well
capability_success = defaultdict(list)

def record_success(capability, context, success):
    capability_success[capability].append({
        "context": context,
        "success": success
    })

def suggest_capabilities(context):
    """Suggest based on historical success"""
    return rank_by_success(capabilities, context)
```

### 8.5 Tool/Agent Introduction
```python
# First time using a capability
if not user_has_used("task"):
    voice.speak("By the way, I can delegate complex tasks to "
                "specialized agents. Just say things like "
                "'analyze this code' or 'write tests for this'.")
```

### 8.6 Capability Probing
```python
# Voice model learns Amplifier capabilities at session start
async def probe_capabilities():
    tools = await amplifier.get_tools()
    agents = await amplifier.get_agents()
    return {
        "direct_tools": tools,
        "delegatable_agents": agents,
        "combined_capabilities": merge_capabilities(tools, agents)
    }
```

### 8.7 Natural Language Capability Matching
```python
# User: "can you check if this code is secure?"
matches = match_intent_to_capabilities(
    "check if this code is secure",
    all_capabilities
)
# Returns: [("security-reviewer", 0.95), ("code-analyzer", 0.7)]
```

---

## 9. Feedback Loops

### 9.1 Push Progress Updates
```python
# Amplifier → Voice (during long tasks)
@on_agent_progress
def push_to_voice(progress):
    if voice_session.active:
        voice.interject(f"Quick update: {progress.message}")
```

### 9.2 Milestone Notifications
```python
MILESTONES = ["planning_complete", "implementation_50%", "tests_passing", "done"]

@on_milestone
def notify_milestone(milestone):
    voice.speak(MILESTONE_MESSAGES[milestone])
```

### 9.3 Error Alerts
```python
@on_agent_error
def alert_voice(error):
    voice.interject(f"Heads up: {error.summary}. {error.suggestion}")
```

### 9.4 Completion Callbacks
```python
# Register callback when starting task
task_id = await task_async(agent, instruction, 
    on_complete=lambda r: voice.speak(f"Finished: {summarize(r)}"))
```

### 9.5 Periodic Status Summaries
```python
# Every N minutes of active work
@periodic(minutes=2)
def status_summary():
    if active_tasks:
        voice.speak(f"Status update: {summarize_active_tasks()}")
```

### 9.6 User-Requested Updates
```python
# User: "how's it going?"
# Voice polls Amplifier for status
status = await amplifier.get_status()
voice.speak(format_status(status))
```

### 9.7 Event Stream to Voice
```python
async def stream_events_to_voice():
    async for event in amplifier.event_stream():
        if event.important_for_user:
            voice.speak(event.to_speech())
```

### 9.8 Confirmation Requests
```python
# Agent needs user input
@on_agent_question
def ask_user(question):
    voice.speak(question.text)
    answer = await voice.listen()
    return answer
```

### 9.9 Sentiment-Aware Updates
```python
# Adjust update frequency based on user engagement
if user_seems_impatient:
    increase_update_frequency()
elif user_seems_busy:
    decrease_update_frequency()
```

---

## 10. Hierarchical Control

### 10.1 Three-Layer Architecture
```
Layer 1: Human (ultimate authority)
Layer 2: Voice Model (human interface, simple decisions)
Layer 3: Amplifier Agents (execution, complex work)
```

### 10.2 Clear Responsibility Boundaries
```python
VOICE_RESPONSIBILITIES = {
    "understand_intent": True,
    "choose_agent": True,
    "summarize_results": True,
    "make_code_changes": False,  # Delegate
    "execute_commands": False,   # Delegate
}

AMPLIFIER_RESPONSIBILITIES = {
    "understand_intent": False,  # Voice does this
    "execute_tools": True,
    "make_decisions": True,  # Within delegated scope
    "report_progress": True,
}
```

### 10.3 Escalation Paths
```python
# When agent is uncertain
if confidence < 0.7:
    escalate_to_voice("I'm not sure about this. {options}")
    
# When voice is uncertain
if complexity > threshold:
    delegate_to_agent("planner", "help me understand this")
```

### 10.4 Authority Levels
```python
AUTHORITY = {
    "human": 10,      # Can do anything
    "voice": 5,       # Can read, route, summarize
    "agent": 3,       # Can execute within bounds
    "tool": 1         # Can only do specific operation
}

def can_perform(actor, action):
    return AUTHORITY[actor] >= action.required_authority
```

### 10.5 Command Chain
```
Human Command → Voice Interpretation → Agent Instructions → Tool Execution
     ↑                                                           ↓
     └─────────────────── Results ◄─────────────────────────────┘
```

### 10.6 Override Mechanisms
```python
# Human can always override agent decisions
@voice_command("stop everything")
def emergency_stop():
    cancel_all_tasks()
    voice.speak("All tasks stopped.")

@voice_command("ignore that suggestion")
def override_agent():
    current_task.ignore_recommendation()
```

### 10.7 Delegation Contracts
```python
class DelegationContract:
    """Explicit agreement when delegating to agent"""
    scope: str  # What agent can do
    constraints: List[str]  # What agent must not do
    timeout: int  # Max time
    checkpoint_interval: int  # How often to report
    escalation_triggers: List[str]  # When to ask human
```

---

## 11. Error Propagation

### 11.1 Error Classification
```python
class ErrorSeverity(Enum):
    INFO = 1      # "File not found" - just inform
    WARNING = 2   # "This might not work" - inform with caution
    ERROR = 3     # "Task failed" - need to explain
    CRITICAL = 4  # "System error" - immediate attention
```

### 11.2 Voice-Friendly Error Messages
```python
ERROR_TRANSLATIONS = {
    "FileNotFoundError": "I couldn't find that file. Want to search for it?",
    "PermissionError": "I don't have permission to access that. Is it protected?",
    "TimeoutError": "That's taking too long. Should I keep trying?",
    "SyntaxError": "There's a syntax error in the code at line {line}.",
}
```

### 11.3 Error Recovery Suggestions
```python
def handle_error(error):
    voice.speak(error.message)
    if suggestions := error.recovery_suggestions:
        voice.speak(f"You could: {', '.join(suggestions)}")
```

### 11.4 Partial Success Reporting
```python
# Task partially succeeded
if result.partial:
    voice.speak(f"I completed {result.completed} of {result.total} items. "
                f"Failed on: {result.failures}. "
                f"Want me to retry the failures?")
```

### 11.5 Error Context Preservation
```python
class RichError:
    message: str
    context: Dict  # What was happening
    cause: Optional[Exception]
    recovery_attempted: bool
    suggestions: List[str]
    voice_friendly_message: str
```

### 11.6 Retry Strategies
```python
async def execute_with_retry(tool, args):
    for attempt in range(3):
        try:
            return await tool.execute(args)
        except RetryableError as e:
            voice.speak(f"Attempt {attempt + 1} failed. Retrying...")
    voice.speak("Failed after 3 attempts. Here's what went wrong...")
```

### 11.7 Error Aggregation
```python
# Multiple errors, don't overwhelm voice
errors = collect_errors(task_results)
if len(errors) > 3:
    voice.speak(f"{len(errors)} issues found. The main problems are: {top_3_errors}")
else:
    for error in errors:
        voice.speak(error.message)
```

### 11.8 Graceful Degradation Narration
```python
# When falling back to simpler approach
voice.speak("The full analysis failed, but I can still give you a basic overview...")
```

---

## 12. Resource Management

### 12.1 Session Pool Management
```python
class SessionPool:
    max_sessions: int = 5
    active_sessions: Dict[str, AmplifierSession]
    
    async def get_session(self, voice_session_id):
        if len(self.active_sessions) >= self.max_sessions:
            await self.evict_oldest()
        return await self.create_session(voice_session_id)
```

### 12.2 Task Resource Limits
```python
RESOURCE_LIMITS = {
    "max_concurrent_tasks": 3,
    "max_task_duration": 300,  # seconds
    "max_memory_per_task": "1GB",
    "max_files_modified": 20
}
```

### 12.3 Cleanup Strategies
```python
@on_voice_session_end
async def cleanup(session_id):
    tasks = get_tasks_for_session(session_id)
    for task in tasks:
        if task.status == "running":
            await task.graceful_stop()
    await release_resources(session_id)
```

### 12.4 Resource Monitoring
```python
async def monitor_resources():
    while True:
        stats = get_resource_stats()
        if stats.memory_high:
            voice.warn("Running low on resources. Some tasks may slow down.")
        if stats.tasks_queued:
            voice.inform(f"{stats.queued} tasks waiting.")
        await asyncio.sleep(60)
```

### 12.5 Cost Tracking
```python
class CostTracker:
    voice_tokens: int = 0
    agent_tokens: int = 0
    
    def report(self):
        return f"Session cost: ~${self.estimate_cost()}"
```

### 12.6 Automatic Resource Scaling
```python
# Scale Amplifier resources based on demand
if queue_depth > threshold:
    scale_up_workers()
elif idle_time > threshold:
    scale_down_workers()
```

### 12.7 Session Timeout Management
```python
# Voice has 15-minute limit
class SessionTimeoutManager:
    def warn_approaching_timeout(self, remaining_minutes):
        if remaining_minutes == 2:
            voice.speak("Heads up, our session will refresh in 2 minutes. "
                       "Long-running tasks will continue in the background.")
```

---

## 13. Security Boundaries

### 13.1 Action Classification
```python
REQUIRES_CONFIRMATION = {
    "write_file": False,       # Agent can do within task
    "delete_file": True,       # Always ask human
    "bash_rm": True,           # Always ask human
    "git_push": True,          # Always ask human
    "external_api_call": True  # Ask if unknown API
}
```

### 13.2 Permission Scopes
```python
class PermissionScope:
    read_only: bool = True         # Default
    write_workspace: bool = False  # Must be granted
    execute_commands: bool = False # Must be granted
    network_access: bool = False   # Must be granted
    
    @classmethod
    def from_user_trust(cls, trust_level):
        if trust_level == "high":
            return cls(read_only=False, write_workspace=True, execute_commands=True)
        # ...
```

### 13.3 Sensitive Data Handling
```python
SENSITIVE_PATTERNS = [
    r"api[_-]?key",
    r"password",
    r"secret",
    r"token"
]

def filter_sensitive(text):
    for pattern in SENSITIVE_PATTERNS:
        text = re.sub(f"{pattern}\\s*=\\s*\\S+", f"{pattern}=[REDACTED]", text, flags=re.I)
    return text
```

### 13.4 Path Restrictions
```python
ALLOWED_PATHS = [
    Path.cwd(),  # Working directory
    Path.home() / "projects",  # User's projects
]

def validate_path(path):
    return any(path.is_relative_to(allowed) for allowed in ALLOWED_PATHS)
```

### 13.5 Voice Confirmation for Risky Actions
```python
async def execute_with_confirmation(action):
    if action.risk_level > THRESHOLD:
        voice.speak(f"This will {action.description}. Should I proceed?")
        if not await voice.get_confirmation():
            return ActionResult(cancelled=True)
    return await action.execute()
```

### 13.6 Audit Logging
```python
@on_any_action
def audit_log(action):
    log.info(f"[AUDIT] User={user_id} Action={action.name} "
             f"Target={action.target} Result={action.result}")
```

### 13.7 Rate Limiting
```python
RATE_LIMITS = {
    "write_file": 10,      # per minute
    "bash": 5,             # per minute
    "external_api": 20     # per minute
}
```

### 13.8 Sandboxing for Untrusted Operations
```python
async def execute_sandboxed(operation):
    """Run in isolated environment"""
    container = create_sandbox_container()
    try:
        return await container.execute(operation)
    finally:
        container.cleanup()
```

---

## 14. Caching Strategies

### 14.1 Result Caching
```python
class ResultCache:
    """Cache Amplifier results for voice reference"""
    
    def get_or_execute(self, tool, args, ttl=300):
        key = hash((tool, frozenset(args.items())))
        if cached := self.cache.get(key):
            return cached
        result = await execute(tool, args)
        self.cache.set(key, result, ttl=ttl)
        return result
```

### 14.2 Context-Aware Caching
```python
# Cache frequently accessed files
if access_count(file_path) > 5:
    cache_file_content(file_path, ttl=60)
```

### 14.3 Conversation Memory Cache
```python
class ConversationCache:
    """Cache recent results for "what was that?" queries"""
    recent_results: List[Tuple[Query, Result]]
    max_items: int = 20
    
    def recall(self, query):
        """Find result matching natural language query"""
        return semantic_search(query, self.recent_results)
```

### 14.4 Tool Schema Caching
```python
# Cache tool schemas to avoid repeated discovery
TOOL_SCHEMAS = {}

async def get_tool_schema(tool_name):
    if tool_name not in TOOL_SCHEMAS:
        TOOL_SCHEMAS[tool_name] = await discover_schema(tool_name)
    return TOOL_SCHEMAS[tool_name]
```

### 14.5 Agent Response Patterns
```python
# Cache common agent response patterns
AGENT_PATTERNS = {
    "file_not_found": "The file {file} doesn't exist. Similar files: {similar}",
    # ...
}
```

### 14.6 Incremental Caching
```python
# Cache partial results for long operations
class IncrementalCache:
    def cache_partial(self, operation_id, partial_result):
        """Cache as we go, so interruption doesn't lose work"""
        self.partials[operation_id].append(partial_result)
```

### 14.7 Cross-Session Cache
```python
# Persist useful results across voice sessions
PERSISTENT_CACHE = PersistentDict("~/.voice-cache.db")

def cache_for_future(key, value, ttl=3600):
    PERSISTENT_CACHE.set(key, value, expires=now() + ttl)
```

### 14.8 Smart Cache Invalidation
```python
@on_file_change(path)
def invalidate_related(path):
    # Invalidate caches that depended on this file
    for cache_key in find_dependent_caches(path):
        cache.invalidate(cache_key)
```

---

## 15. State Machines

### 15.1 Voice Session State Machine
```
┌─────────┐     connect     ┌──────────┐
│  INIT   │ ───────────────▶│ LISTENING │
└─────────┘                 └────┬─────┘
                                 │
                    user speaks  │  voice responds
                                 ▼
                           ┌──────────┐
                           │ PROCESSING│◀─────────────┐
                           └────┬─────┘              │
                                │                     │
               ┌────────────────┼────────────────┐   │
               ▼                ▼                ▼   │
        ┌──────────┐    ┌─────────────┐   ┌─────────┴─┐
        │ SPEAKING │    │ DELEGATING  │   │ WAITING   │
        └────┬─────┘    └──────┬──────┘   │ FOR_INPUT │
             │                 │          └───────────┘
             │                 │
             └────────┬────────┘
                      ▼
               ┌──────────┐
               │ LISTENING │
               └──────────┘
```

### 15.2 Task Lifecycle State Machine
```
┌──────────┐    start    ┌─────────┐   complete   ┌───────────┐
│ CREATED  │ ──────────▶ │ RUNNING │ ───────────▶ │ COMPLETED │
└──────────┘             └────┬────┘              └───────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌─────────┐    ┌──────────┐    ┌─────────┐
        │ WAITING │    │ ERRORED  │    │ CANCELED│
        │ _INPUT  │    └──────────┘    └─────────┘
        └─────────┘
```

### 15.3 Agent Coordination State Machine
```
       ┌─────────────────────────────────────────┐
       │              ORCHESTRATOR               │
       └─────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ AGENT_A  │   │ AGENT_B  │   │ AGENT_C  │
    │ (active) │   │ (waiting)│   │ (idle)   │
    └──────────┘   └──────────┘   └──────────┘
```

### 15.4 Error Recovery State Machine
```
┌─────────┐    error    ┌─────────┐   recoverable   ┌─────────┐
│ NORMAL  │ ──────────▶ │ ERROR   │ ──────────────▶ │ RETRY   │
└─────────┘             └────┬────┘                 └────┬────┘
     ▲                       │                           │
     │                       │ not recoverable           │ success
     │                       ▼                           │
     │                 ┌───────────┐                     │
     │                 │ ESCALATE  │                     │
     │                 │ TO_HUMAN  │                     │
     │                 └───────────┘                     │
     └──────────────────────────────────────────────────┘
```

### 15.5 Context Sync State Machine
```
┌─────────────┐    change    ┌────────────┐    sync    ┌────────────┐
│ SYNCHRONIZED│ ───────────▶ │ DIRTY      │ ─────────▶ │ SYNCING    │
└─────────────┘              └────────────┘            └─────┬──────┘
       ▲                                                     │
       │                                                     │
       └─────────────────────────────────────────────────────┘
                               complete
```

### 15.6 Combined System State
```python
class SystemState:
    voice: VoiceState
    amplifier: AmplifierState
    tasks: Dict[str, TaskState]
    context: ContextState
    
    def get_valid_transitions(self):
        """Return valid state transitions from current state"""
        ...
    
    def transition(self, event):
        """Apply event and return new state"""
        ...
```

### 15.7 Hierarchical State Machine
```python
class VoiceAmplifierHSM:
    """Hierarchical state machine for complex states"""
    
    states = {
        "idle": {},
        "active": {
            "listening": {},
            "processing": {
                "local": {},
                "delegated": {
                    "waiting": {},
                    "streaming": {}
                }
            },
            "speaking": {}
        },
        "error": {
            "recoverable": {},
            "fatal": {}
        }
    }
```

---

## 16. Additional Patterns

### 16.1 Voice Personas
```python
PERSONAS = {
    "professional": {
        "tone": "formal",
        "verbosity": "concise",
        "confirmations": "minimal"
    },
    "friendly": {
        "tone": "casual",
        "verbosity": "explanatory",
        "confirmations": "conversational"
    }
}
```

### 16.2 Multi-Modal Feedback
```python
# Voice + Visual UI
class MultiModalResponse:
    voice_summary: str  # Spoken
    visual_detail: Dict  # Shown in UI
    code_snippet: Optional[str]  # Highlighted in editor
```

### 16.3 Learning from Corrections
```python
# User: "No, I meant the other file"
@on_correction
def learn_from_correction(original, correction):
    update_understanding(original, correction)
    voice.speak("Got it, you meant {correction}. I'll remember that.")
```

### 16.4 Proactive Suggestions
```python
# Based on patterns
if user_repeatedly_does(pattern):
    voice.suggest(f"I notice you often {pattern}. "
                  f"Would you like me to do that automatically?")
```

### 16.5 Context Windowing
```python
# Manage context size for voice model
class ContextWindow:
    max_tokens: int = 32000
    
    def fit(self, items: List[ContextItem]) -> List[ContextItem]:
        """Prioritize and fit items within window"""
        sorted_items = sorted(items, key=lambda x: x.priority, reverse=True)
        result = []
        tokens = 0
        for item in sorted_items:
            if tokens + item.tokens <= self.max_tokens:
                result.append(item)
                tokens += item.tokens
        return result
```

### 16.6 Graceful Voice Model Limits
```python
# When voice model hits limits
if voice_model_confused:
    voice.speak("This is getting complex. Let me hand it off to "
                "a specialist who can handle the details.")
    delegate_to_amplifier()
```

### 16.7 Session Analytics
```python
class SessionAnalytics:
    def track(self):
        return {
            "duration": self.duration,
            "turns": self.turn_count,
            "tasks_completed": self.tasks_completed,
            "errors_encountered": self.errors,
            "user_satisfaction": self.inferred_satisfaction
        }
```

### 16.8 A/B Testing Patterns
```python
# Test different delegation strategies
if experiment("delegation_strategy") == "aggressive":
    delegate_everything_complex()
elif experiment("delegation_strategy") == "conservative":
    try_voice_first_then_delegate()
```

### 16.9 Fallback Chains
```python
FALLBACK_CHAIN = [
    ("voice_direct", 0.9),      # Try voice first if confidence > 0.9
    ("quick_agent", 0.7),       # Try quick agent if confidence > 0.7
    ("full_agent", 0.0),        # Full agent as last resort
]

async def execute_with_fallback(intent):
    for strategy, threshold in FALLBACK_CHAIN:
        if intent.confidence >= threshold:
            return await strategies[strategy](intent)
```

### 16.10 Intent Clarification Protocol
```python
# When intent is ambiguous
if intent.confidence < 0.6:
    options = intent.top_interpretations[:3]
    voice.speak(f"Did you mean: {format_options(options)}?")
    clarification = await voice.listen()
    intent = refine_intent(intent, clarification)
```

---

## Summary Matrix

| Pattern Category | Voice-Centric | Amplifier-Centric | Hybrid |
|------------------|---------------|-------------------|--------|
| Tool Exposure | Direct tools | Task only | Tiered |
| Orchestration | Voice routes | Agent orchestrator | Dynamic |
| Context | Voice context | Amplifier context | Shared store |
| Delegation | Sync | Async | Progressive |
| Summarization | Voice LLM | Pre-computed | Templates |
| Multi-Agent | Voice coordinates | Supervisor agent | Both |
| Sessions | Voice primary | Amplifier persists | Federation |
| Discovery | Voice asks | Self-describing | Dynamic |
| Feedback | Polling | Push | Events |
| Control | Voice authority | Agent autonomy | Hierarchical |
| Errors | Voice handles | Agent handles | Escalation |
| Resources | Per-voice | Shared pool | Adaptive |
| Security | Voice confirms | Agent sandboxed | Layered |
| Caching | Voice-side | Agent-side | Distributed |
| State | Voice FSM | Agent FSM | Combined HSM |

---

## Recommended Starting Points

1. **Quick Win**: Implement tiered tool exposure (1.2) with result caching (14.1)
2. **Robust Foundation**: Build session bridging (7.1-7.4) and error propagation (11.1-11.3)
3. **Great UX**: Add progressive updates (4.3) and voice-friendly summaries (5.2)
4. **Scale**: Implement session pool (12.1) and state machines (15.1-15.4)

---

## Open Questions

1. Should voice ever have direct write access, or always delegate?
2. How to handle voice session timeout mid-complex-task?
3. What's the right balance between voice autonomy and agent delegation?
4. How to make agent work feel "instant" to voice users?
5. Should there be a "power user" mode with more direct tools?

# Brainstorm 13: Notification and Alert Patterns

## Overview

Voice interfaces face unique notification challenges compared to visual UIs. Users can't "glance" at a notification - they must listen. This creates tension between keeping users informed and respecting their attention. This document explores patterns for proactive, intelligent voice notifications.

---

## Core Philosophy

### The Attention Budget

Voice notifications spend from a limited attention budget:
- **Visual notifications**: User chooses when to look (pull model)
- **Voice notifications**: System interrupts user (push model)

Every spoken notification is an interruption. Design accordingly.

### The Hierarchy of Notification Modalities

```
Most Intrusive                              Least Intrusive
     │                                            │
     ▼                                            ▼
Full Speech → Short Speech → Earcon → Ambient → Silent
"Your build    "Build done"   *ding*   (subtle    (log only)
 completed                             tone)
 successfully
 with 47 tests
 passing"
```

---

## 1. Task Completion Notifications

### Pattern: Graduated Success Announcements

**Concept**: Scale verbosity to task importance and duration.

```
Quick task (<30 seconds):
  Audio: Subtle success chime
  Optional: "Done"

Medium task (30s - 5 min):
  Audio: Pleasant completion tone
  Speech: "Your analysis is ready"

Long task (>5 min):
  Audio: Distinctive completion melody
  Speech: "Your build finished successfully. 47 tests passed, 
           no warnings. Would you like the details?"

Failed task:
  Audio: Attention-getting but not alarming tone
  Speech: "Your build encountered an issue. Three tests failed.
           Want me to explain?"
```

### Pattern: Contextual Result Summaries

**Concept**: Include the most relevant outcome detail.

```
Build: "Build finished. All green." or "Build failed. 3 type errors."
Analysis: "Found 12 issues, 2 critical."
Search: "Found 47 matches across 8 files."
Test: "All 156 tests pass in 4 seconds."
Deploy: "Deployed to staging. Health checks passing."
```

### Pattern: Deferred Results

**Concept**: For very long tasks, offer to notify later.

```
User: "Run the full test suite"
System: "That usually takes about 15 minutes. I'll let you know 
         when it's done. Want me to interrupt you, or just 
         have the results ready when you ask?"

Options:
- "Interrupt me" → Full notification when complete
- "Just have it ready" → Silent completion, announce on next interaction
- "Remind me in 10 minutes" → Time-based follow-up
```

---

## 2. Error Alert Patterns

### Pattern: Severity-Scaled Alerts

**Concept**: Match alert urgency to error severity.

```
Level 1 - Informational:
  Audio: None or soft click
  Speech: Mentioned only if user asks
  Example: "Skipped 2 cached dependencies"

Level 2 - Warning:
  Audio: Gentle attention tone
  Speech: "Heads up - 3 deprecation warnings in your code"
  Action: Continue without intervention

Level 3 - Error:
  Audio: Distinct error tone
  Speech: "Your task couldn't complete. Authentication failed."
  Action: Requires user decision

Level 4 - Critical:
  Audio: Urgent but not alarming
  Speech: "Important: Your database connection dropped. 
           Should I retry or would you like to investigate?"
  Action: Immediate attention needed
```

### Pattern: Error Context Preservation

**Concept**: Offer details without overwhelming.

```
Initial: "Your script failed with a type error on line 47."

User options:
- "What happened?" → Explain the error
- "Show me" → Open file at location (if visual available)
- "Read the error" → Full error message
- "Fix it" → Attempt auto-fix
- "Skip it" → Continue/acknowledge
```

### Pattern: Recovery-Oriented Errors

**Concept**: Lead with solutions, not problems.

```
❌ Problem-first:
"Error: ECONNREFUSED. Connection refused on port 5432."

✓ Solution-first:
"Can't reach the database. Want me to check if Postgres is running?"

❌ Technical dump:
"TypeError: Cannot read property 'map' of undefined at line 234"

✓ Actionable:
"There's a null value where your code expected an array, line 234. 
 Should I show you the context?"
```

---

## 3. Progress Update Patterns

### Pattern: Milestone-Based Updates

**Concept**: Report at meaningful milestones, not arbitrary intervals.

```
Build process:
- "Starting build..."
- "Dependencies resolved"
- "Compiling... about halfway"
- "Running tests"
- "93 of 100 tests complete"
- "Build finished successfully"

Long analysis:
- "Analyzing your codebase..."
- "Scanned 500 files so far"
- "Found the module you mentioned, digging deeper"
- "Almost done, processing final dependencies"
- "Analysis complete"
```

### Pattern: Adaptive Progress Verbosity

**Concept**: Adjust chattiness based on user engagement.

```
If user is actively talking/working:
  → Minimal updates, only milestones
  
If user asked "how's it going?":
  → More detailed progress
  
If user seems to be waiting:
  → Regular updates with estimates

If user started another task:
  → Silent until complete
```

### Pattern: Estimated Time Announcements

**Concept**: Set expectations, then stay quiet unless wrong.

```
Start: "This usually takes about 3 minutes. I'll let you know 
        when it's done."

[Stay silent during normal progress]

If taking longer:
  "This is taking a bit longer than usual - about 2 more minutes.
   Want me to keep going?"

If much faster:
  "That was quick - done in 30 seconds. All clear."
```

### Pattern: Background Task Status

**Concept**: User can query status on demand.

```
User: "What's happening?"
System: "I've got three things running:
         - Your build is about 60% done
         - Still searching that log file
         - Deployment is queued, waiting for the build"
```

---

## 4. Time-Sensitive Notifications

### Pattern: Temporal Urgency Scaling

**Concept**: Increase urgency as deadline approaches.

```
Meeting in 30 minutes:
  → No notification (too early)

Meeting in 10 minutes:
  Audio: Gentle chime
  Speech: "Your standup is in 10 minutes"

Meeting in 2 minutes:
  Audio: More prominent tone
  Speech: "Standup starts in 2 minutes"

Meeting starting now:
  Audio: Clear alert
  Speech: "Your standup is starting now"
```

### Pattern: Smart Calendar Integration

**Concept**: Understand meeting importance and prep time.

```
Regular 1:1: Notify at 5 minutes
Important presentation: Notify at 15 minutes ("Your board 
  presentation is in 15 minutes. Want to review your notes?")
All-day events: Morning summary only
Back-to-back meetings: "You've got meetings back-to-back until 3pm"
```

### Pattern: Contextual Time Alerts

**Concept**: Include relevant preparation info.

```
"Your design review starts in 10 minutes. 
 You have 3 unread comments on the proposal."

"Standup in 5. Your PR from yesterday was merged."

"Interview with Sarah in 15 minutes. 
 Want me to pull up her resume?"
```

---

## 5. Ambient Notification Patterns

### Pattern: Earcon Library

**Concept**: Non-verbal audio cues for common events.

```
Success sounds:
  - Task complete: Pleasant rising tone
  - Test passed: Quick bright chirp
  - Deploy succeeded: Triumphant mini-flourish

Warning sounds:
  - Attention needed: Gentle double-tap
  - Warning: Soft low tone
  - Error: Distinct but not jarring alert

Progress sounds:
  - Started: Subtle whoosh
  - Milestone: Soft tick
  - Waiting: Optional ambient pulse

System sounds:
  - Listening activated: Quick chirp
  - Thinking: Subtle processing hum
  - Ready: Gentle chime
```

### Pattern: Ambient Status Indicators

**Concept**: Background audio for ongoing states.

```
While building:
  → Very soft, rhythmic pulsing (barely audible)
  
While waiting for user:
  → Silence with occasional "still here" tone (configurable)
  
Error state:
  → Subtle persistent tone until acknowledged

Network issues:
  → Distinctive pattern indicating degraded connectivity
```

### Pattern: Audio Texture Mapping

**Concept**: Different "textures" for different domains.

```
Code/Build tasks: Digital, synthetic tones
Calendar/Time: Organic, bell-like tones  
Messages/Communication: Human, vocal undertones
Errors/Warnings: Attention-getting but pleasant
Success: Warm, satisfying resolution tones
```

---

## 6. Priority Level Patterns

### Pattern: Four-Tier Priority System

```
P0 - Critical (Always interrupt):
  - Security alerts
  - Data loss risks
  - Production incidents
  - User explicitly requested immediate notification
  
P1 - High (Interrupt unless DND):
  - Task completions
  - Errors requiring decisions
  - Time-sensitive calendar items
  - Explicit user requests
  
P2 - Medium (Batch and summarize):
  - Warnings
  - Non-urgent completions
  - FYI notifications
  
P3 - Low (On-demand only):
  - Informational logs
  - Stats and metrics
  - Background activity
```

### Pattern: Priority Inference

**Concept**: Intelligently infer priority from context.

```
"Let me know when the deploy finishes"
  → P1, user explicitly wants notification

Background build while user codes:
  → P2 if success, P1 if failure

Build user is actively waiting for:
  → P1 regardless of outcome

Security vulnerability found:
  → P0 always
```

### Pattern: User-Defined Priority Rules

```
User: "Don't interrupt me for warnings, just errors"
System: Stores preference, applies to future notifications

User: "Treat database errors as critical"
System: Elevates all DB-related errors to P0

User: "Calendar notifications for meetings with my manager only"
System: Filters notifications by attendee
```

---

## 7. Do-Not-Disturb Patterns

### Pattern: Focus Mode Detection

**Concept**: Infer focus from user behavior.

```
Signals of deep focus:
- Extended silence (10+ minutes of no interaction)
- User said "let me focus" or similar
- Active typing sounds (if detectable)
- Time blocks marked as focus time

Response:
- Queue non-critical notifications
- Only interrupt for P0
- Reduce or eliminate ambient sounds
```

### Pattern: Explicit Focus Mode

```
User: "Don't disturb me for the next hour"
System: "Got it. I'll queue everything except critical alerts. 
         I'll check in at 3pm."

[During focus time]
- P0-P1 items: Stored for delivery at end
- P0 only: Delivered with apology ("Sorry to interrupt, but...")

[End of focus time]
System: "Your focus time is up. You have 3 notifications: 
         your build succeeded, a calendar reminder, and 
         two PR reviews are ready."
```

### Pattern: Graduated DND Levels

```
Level 1 - Soft focus:
  Allow: Task completions, calendar, errors
  Defer: Warnings, informational, stats
  
Level 2 - Deep focus:
  Allow: Critical errors, security alerts
  Defer: Everything else
  
Level 3 - Absolute silence:
  Allow: Nothing
  Defer: Everything (user must check manually)
```

### Pattern: Smart Interruption Decisions

```
Before interrupting, evaluate:
1. Is this P0? → Interrupt
2. Is user in focus mode? → Queue unless P0
3. Is user mid-sentence/task? → Wait for natural pause
4. Has user been idle? → Safe to notify
5. Multiple items pending? → Batch into summary
```

---

## 8. Notification Queuing Patterns

### Pattern: Intelligent Batching

**Concept**: Group related notifications.

```
Instead of:
  "Test 1 passed"
  "Test 2 passed"  
  "Test 3 passed"
  "Build complete"

Batched:
  "Build complete. All 3 tests passed."

Instead of:
  "PR approved by Alice"
  "PR approved by Bob"
  "PR comment from Carol"

Batched:
  "3 updates on your PR: approved by Alice and Bob, 
   Carol left a comment."
```

### Pattern: Priority-Ordered Delivery

**Concept**: Most important first when delivering queue.

```
"You have 4 notifications while you were away:
 
 First - your production deploy failed, needs attention.
 
 Also: your build on feature-branch succeeded,
 you have a meeting in 20 minutes,
 and 2 PRs are ready for review."
```

### Pattern: Queue Summarization

**Concept**: Collapse similar items into summaries.

```
10 similar notifications:
  "You had 10 notifications, mostly test results. 
   8 succeeded, 2 failed. Want details on the failures?"

Mixed queue:
  "While you were focused: 2 builds finished, 
   3 calendar reminders, and a security alert 
   that's still pending. Start with the alert?"
```

### Pattern: Queue Management Commands

```
"What's pending?"
  → List all queued items

"Skip the calendar stuff"
  → Remove calendar items from queue

"Just give me errors"
  → Filter to error notifications only

"Clear everything"
  → Mark all as read/dismissed
```

---

## 9. Acknowledgment Patterns

### Pattern: Passive Acknowledgment

**Concept**: Assume heard unless user indicates otherwise.

```
System: "Your build finished successfully."
[No response from user]
→ Assume acknowledged, move on

Benefits:
- Less conversational overhead
- Respects user's attention
- Natural flow
```

### Pattern: Active Acknowledgment for Critical Items

**Concept**: Require confirmation for important notifications.

```
System: "Critical: Your database is running out of space. 
         Acknowledge by saying 'got it' or should I explain?"

[Wait for response]

If no response after 30 seconds:
  "Just checking - did you hear about the database space issue?"
```

### Pattern: Implicit Acknowledgment

**Concept**: Next user action implies receipt.

```
System: "Your build failed with 3 errors."
User: "Fix the first one"
→ Implicitly acknowledged, user is engaging with result

System: "Meeting in 5 minutes"
User: [continues working, then says] "Open my notes"
→ Implicitly acknowledged, user is preparing
```

### Pattern: Acknowledgment Memory

**Concept**: Track what user has heard vs. acted on.

```
"The build error I mentioned earlier is still there - 
 want me to help fix it?"

"You've had that calendar reminder for 10 minutes - 
 should I snooze it or dismiss it?"
```

---

## 10. Cross-Device Patterns

### Pattern: Primary Device Routing

**Concept**: Designate one device as notification target.

```
User: "Send notifications to my desk setup"
System: Routes all notifications to designated device

User: "I'm going mobile"  
System: Switches notifications to phone/portable device

Automatic detection:
- Last active device gets notifications
- Idle devices are skipped
- Return to device resumes notifications there
```

### Pattern: Device-Appropriate Formatting

**Concept**: Adapt notification style to device context.

```
Desktop (full attention):
  Full spoken notifications
  Detailed error messages
  Interactive follow-ups

Mobile (on the go):
  Briefer notifications
  More earcons, less speech
  Simple yes/no responses

Headphones (public space):
  Private audio only
  No visual required
  Whisper mode available

Smart speaker (ambient):
  Louder, clearer speech
  Room-appropriate volume
  Consider others present
```

### Pattern: Notification Handoff

**Concept**: Seamlessly transfer ongoing notifications.

```
[On desktop]
System: "Your deployment started, I'll let you know when-"

[User moves to phone]
System: "-it's done. I see you've moved to your phone, 
         I'll notify you there."

[Long task completes]
System: [Notifies whichever device is active]
```

### Pattern: Cross-Device Summary

**Concept**: Sync notification state across devices.

```
[Phone has notifications queued]
[User returns to desktop]

System: "Welcome back. You have 3 notifications from 
         while you were on mobile - want them here?"
         
Options:
- "Yes" → Repeat/summarize
- "No, I saw them" → Mark as acknowledged
- "Later" → Keep in queue
```

---

## UX Anti-Patterns to Avoid

### ❌ Over-notification

```
Bad: "Starting task... 10% complete... 20% complete... 30%..."
Good: "Started. I'll let you know when it's done."
```

### ❌ Vague Notifications

```
Bad: "Something happened with your task."
Good: "Your build failed - type error on line 47."
```

### ❌ Notification Spam

```
Bad: Separate notification for each of 20 test results
Good: "20 tests complete - 18 passed, 2 failed."
```

### ❌ Ignoring Context

```
Bad: Full notification while user is mid-sentence
Good: Wait for pause, then deliver
```

### ❌ No Escape Hatch

```
Bad: No way to silence notifications
Good: "Don't disturb me" / "Quiet mode" always available
```

### ❌ Alarming Tones for Minor Issues

```
Bad: Urgent alarm sound for deprecation warning
Good: Gentle tone for warnings, distinct (not scary) for errors
```

---

## Implementation Considerations

### Notification Event Structure

```python
@dataclass
class VoiceNotification:
    id: str
    priority: Literal["critical", "high", "medium", "low"]
    category: str  # task, calendar, error, system, etc.
    
    # Content
    brief: str           # "Build done"
    standard: str        # "Your build finished successfully"
    detailed: str        # Full details on demand
    
    # Audio
    earcon: str | None   # Sound cue identifier
    speak: bool          # Whether to speak or just sound
    
    # Timing
    created_at: datetime
    expires_at: datetime | None
    deliver_at: datetime | None  # Scheduled delivery
    
    # State
    delivered: bool = False
    acknowledged: bool = False
    
    # Context
    related_task: str | None
    actionable: bool = False
    actions: list[str] = field(default_factory=list)
```

### Notification Manager

```python
class NotificationManager:
    def queue(self, notification: VoiceNotification) -> None
    def deliver_next(self) -> VoiceNotification | None
    def batch_pending(self) -> list[VoiceNotification]
    def summarize_queue(self) -> str
    
    def set_dnd(self, level: int, duration: timedelta) -> None
    def should_interrupt(self, notification: VoiceNotification) -> bool
    
    def set_device(self, device_id: str) -> None
    def sync_across_devices(self) -> None
```

### Configuration Options

```yaml
notifications:
  default_priority: medium
  
  delivery:
    batch_similar: true
    batch_window_seconds: 5
    max_queue_size: 50
    
  verbosity:
    success: brief      # brief | standard | detailed
    error: standard
    progress: minimal   # minimal | milestone | verbose
    
  sounds:
    enabled: true
    success_sound: chime_success
    error_sound: alert_gentle
    warning_sound: tone_low
    
  focus_mode:
    auto_detect: true
    idle_threshold_minutes: 10
    
  acknowledgment:
    require_for_critical: true
    timeout_seconds: 30
```

---

## Open Questions

1. **Notification fatigue measurement**: How do we detect when users are overwhelmed?

2. **Learning preferences**: Should the system learn from user responses to tune notification behavior?

3. **Ambient awareness**: Should there be constant subtle audio feedback that "work is happening"?

4. **Multi-user spaces**: How to handle notifications when others might hear?

5. **Notification history**: Should users be able to "replay" missed notifications?

6. **Visual fallback**: When voice isn't ideal, should notifications appear visually?

7. **Interrupt detection**: How accurately can we detect good moments to interrupt?

---

## Summary

Effective voice notifications require:

| Principle | Implementation |
|-----------|---------------|
| **Respect attention** | Every notification costs attention; spend wisely |
| **Scale to importance** | Critical = interrupt, minor = queue or ambient |
| **Context awareness** | Know when user is focused, waiting, or idle |
| **Offer control** | DND modes, verbosity settings, skip commands |
| **Be actionable** | Lead with what user can do, not just what happened |
| **Batch intelligently** | Group related items, summarize queues |
| **Multi-modal** | Use earcons, speech, and silence appropriately |
| **Graceful degradation** | Work across devices and contexts |

The best notification is one that delivers exactly the right information at exactly the right time in exactly the right way. Voice makes this harder than visual UI but also creates opportunity for more natural, human-like communication patterns.

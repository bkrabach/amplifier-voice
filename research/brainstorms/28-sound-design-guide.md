# Sound Design Guide: Audio Feedback for Voice Interface

> **Date**: 2026-01-31
> **Status**: Design Specification
> **Purpose**: Define audio feedback patterns for non-speech communication

---

## Table of Contents

1. [Philosophy](#1-philosophy)
2. [Notification Sounds](#2-notification-sounds)
3. [State Transition Sounds](#3-state-transition-sounds)
4. [Volume Guidelines](#4-volume-guidelines)
5. [Sound vs Speech Decision Framework](#5-sound-vs-speech-decision-framework)
6. [Technical Specifications](#6-technical-specifications)
7. [Sound Library Reference](#7-sound-library-reference)

---

## 1. Philosophy

### Core Principles

**Sounds Should Feel, Not Interrupt**

Audio feedback exists to create ambient awareness, not to demand attention. The best sound design is felt subconsciously - users know what's happening without consciously processing it.

**The Hierarchy of Audio Communication**

```
Most Information                              Least Information
Most Intrusive                                Least Intrusive
       │                                              │
       ▼                                              ▼
Full Speech → Short Speech → Earcon → Ambient Tone → Silence
```

**Wabi-Sabi Audio**

Embrace imperfection and subtlety:
- Organic tones over synthetic beeps
- Soft attacks, natural decays
- Warmth over precision
- Presence over perfection

### Design Goals

| Goal | Meaning |
|------|---------|
| **Unobtrusive** | Never startle; always inform |
| **Distinctive** | Each sound is immediately recognizable |
| **Consistent** | Same event = same sound, always |
| **Appropriate** | Matches emotional context of event |
| **Accessible** | Clear across hearing abilities and environments |

---

## 2. Notification Sounds

### 2.1 Task Completion Sounds

#### Success - Quick Task (< 30 seconds)

**Sound Profile: "Soft Affirm"**
```
Character:   Gentle, brief acknowledgment
Frequency:   800-1200 Hz primary
Duration:    150-300ms
Envelope:    Soft attack, quick decay
Feeling:     A quiet nod of completion
```

**Musical Description**: Single soft chime, like a distant wind chime touched by breeze. Slight pitch rise (minor third) suggests "done."

**Use Cases**:
- File saved
- Quick search complete
- Single tool executed
- Setting changed

#### Success - Medium Task (30 seconds - 5 minutes)

**Sound Profile: "Satisfied Resolve"**
```
Character:   Warm, complete, satisfying
Frequency:   600-1000 Hz with harmonics
Duration:    400-600ms
Envelope:    Medium attack, full decay
Feeling:     Task accomplished, ready for next
```

**Musical Description**: Two-note resolution (descending perfect fourth or fifth). Warm, rounded tone like wooden marimba or soft bell.

**Use Cases**:
- Build completed
- Analysis finished
- File download complete
- Background task done

#### Success - Long Task (> 5 minutes)

**Sound Profile: "Triumphant Arrival"**
```
Character:   Distinctive, celebratory but not loud
Frequency:   500-1200 Hz melodic sequence
Duration:    800-1200ms
Envelope:    Layered, building to resolution
Feeling:     Achievement unlocked
```

**Musical Description**: Three-note ascending phrase resolving to tonic. Think "task complete" jingle - memorable but not annoying. Similar emotional register to macOS startup sound.

**Use Cases**:
- Long deployment finished
- Large codebase analysis complete
- Complex agent task done
- Session milestone reached

### 2.2 Error Sounds

#### Warning - Non-Blocking

**Sound Profile: "Gentle Attention"**
```
Character:   Noticeable but not alarming
Frequency:   400-600 Hz
Duration:    200-350ms
Envelope:    Quick attack, medium decay
Feeling:     "Heads up" without anxiety
```

**Musical Description**: Soft woodblock or hollow knock. Single tone, slightly lower register than success sounds. Not harsh.

**Use Cases**:
- Deprecation warnings
- Non-critical validation issues
- Rate limit approaching
- Optional update available

#### Error - Recoverable

**Sound Profile: "Soft Block"**
```
Character:   Clear indication something stopped
Frequency:   300-500 Hz
Duration:    300-500ms
Envelope:    Medium attack, dampened decay
Feeling:     "That didn't work" without alarm
```

**Musical Description**: Muted thud or soft "bonk" - like a padded mallet on a drum. Descending minor second suggests incompleteness without drama.

**Use Cases**:
- Task failed but retryable
- Validation error
- Network timeout
- Permission denied

#### Error - Critical

**Sound Profile: "Urgent Attention"**
```
Character:   Demands attention without panic
Frequency:   350-600 Hz with slight dissonance
Duration:    400-700ms
Envelope:    Quick attack, sustained, clean end
Feeling:     "Stop and look at this"
```

**Musical Description**: Two-tone alert - first tone holds, second drops a minor second. Creates tension without being a siren. Think submarine "attention" tone, not car alarm.

**Use Cases**:
- Session disconnected
- Critical system error
- Data integrity issue
- Security alert

### 2.3 Notification Sound Matrix

| Event | Sound | Duration | Volume | Speech Follow-up |
|-------|-------|----------|--------|------------------|
| Quick task done | Soft Affirm | 200ms | 60% | Optional "Done" |
| Medium task done | Satisfied Resolve | 500ms | 70% | Brief summary |
| Long task done | Triumphant Arrival | 1000ms | 75% | Full announcement |
| Warning | Gentle Attention | 250ms | 65% | If actionable |
| Error | Soft Block | 400ms | 70% | Always explain |
| Critical | Urgent Attention | 600ms | 80% | Immediate detail |

---

## 3. State Transition Sounds

### 3.1 Conversation State Sounds

These sounds create ambient awareness of system state without requiring visual attention.

#### IDLE → LISTENING

**Sound Profile: "Awakening"**
```
Character:   Subtle activation, "I'm here"
Frequency:   700-900 Hz
Duration:    100-200ms
Envelope:    Soft attack, quick fade
Feeling:     Door opening quietly
```

**Musical Description**: Single soft tone with slight upward pitch bend. Like a gentle intake of breath. Nearly subliminal.

**Trigger**: VAD detects speech start / User activates mic

#### LISTENING → PROCESSING

**Sound Profile: "Received"**
```
Character:   Acknowledgment of input captured
Frequency:   800-1000 Hz
Duration:    150-250ms
Envelope:    Quick attack, natural decay
Feeling:     Message received
```

**Musical Description**: Soft "click" or subtle chime. Confirms the system heard and is now thinking. Similar to iMessage "sent" sound.

**Trigger**: VAD speech_stopped / User releases push-to-talk

#### PROCESSING (Ambient Loop)

**Sound Profile: "Thinking"**
```
Character:   Ambient presence, working indication
Frequency:   400-600 Hz base with subtle movement
Duration:    Looping, 2-4 second cycle
Envelope:    Smooth, no sharp transients
Feeling:     Gentle concentration
```

**Musical Description**: Soft pulsing tone, like a distant heartbeat or gentle breathing. Very low in mix - felt more than heard. Subtle pitch/timbre variation prevents monotony.

**Trigger**: Processing begins, loops until complete
**Note**: Optional - some users prefer silence during processing

#### PROCESSING → SPEAKING

**Sound Profile: "Ready to Speak"**
```
Character:   Transition marker, attention shift
Frequency:   600-800 Hz
Duration:    100-150ms
Envelope:    Quick, clean
Feeling:     "Here comes the answer"
```

**Musical Description**: Brief, bright tone. Signals audio response is about to begin. Helps users orient attention.

**Trigger**: First audio chunk ready to play

#### SPEAKING → IDLE

**Sound Profile: "Complete"**
```
Character:   Natural conversation end
Frequency:   500-700 Hz
Duration:    200-300ms
Envelope:    Soft attack, gentle fade
Feeling:     Conversation pause
```

**Musical Description**: Soft descending tone. Like a sentence ending with a period. Creates natural break.

**Trigger**: Response playback complete, returning to listening

### 3.2 Tool Execution Sounds

#### Tool Started

**Sound Profile: "Action Initiated"**
```
Character:   Quick, purposeful
Frequency:   600-900 Hz
Duration:    100-150ms
Envelope:    Crisp attack, quick decay
Feeling:     "On it"
```

**Musical Description**: Soft click or tap. Confirms action is beginning.

#### Tool Complete

**Sound Profile: "Action Done"**
```
Character:   Brief success
Frequency:   800-1100 Hz
Duration:    150-200ms
Envelope:    Medium attack, clean decay
Feeling:     Check mark
```

**Musical Description**: Soft upward chime. Quick acknowledgment.

### 3.3 Amplifier/Background Task Sounds

#### Long Task Started

**Sound Profile: "Background Engaged"**
```
Character:   Acknowledges handoff to background
Frequency:   500-800 Hz sequence
Duration:    300-500ms
Envelope:    Smooth transitions
Feeling:     "I've got this, you can continue"
```

**Musical Description**: Soft two-note phrase, like "okay" in tones. Indicates work is happening but attention not required.

#### Progress Milestone

**Sound Profile: "Checkpoint"**
```
Character:   Subtle progress marker
Frequency:   700-1000 Hz
Duration:    100-150ms
Envelope:    Soft, brief
Feeling:     Progress tick
```

**Musical Description**: Nearly silent soft tap. Can be disabled. Just enough to know something happened.

### 3.4 State Sound Matrix

| Transition | Sound | Duration | Volume | Notes |
|------------|-------|----------|--------|-------|
| → Listening | Awakening | 150ms | 50% | Subtle activation |
| → Processing | Received | 200ms | 55% | Input acknowledged |
| Processing (loop) | Thinking | 3s loop | 30% | Optional ambient |
| → Speaking | Ready | 120ms | 45% | Attention shift |
| → Idle | Complete | 250ms | 50% | Natural endpoint |
| Tool start | Action | 120ms | 45% | Quick confirm |
| Tool done | Done | 175ms | 50% | Brief success |
| Background start | Engaged | 400ms | 55% | Handoff confirm |
| Background progress | Checkpoint | 100ms | 35% | Optional tick |

---

## 4. Volume Guidelines

### 4.1 Volume Hierarchy

All volumes are relative to system volume (user's master setting).

```
100% ─┬─ User's system volume (never exceed)
      │
 85% ─┼─ Critical alerts (rare, important)
      │
 75% ─┼─ Task completion (long tasks)
      │
 70% ─┼─ Errors, important notifications
      │
 60% ─┼─ Standard notifications, warnings
      │
 50% ─┼─ State transitions, confirmations
      │
 40% ─┼─ Subtle feedback, ambient sounds
      │
 30% ─┼─ Background processing indicators
      │
  0% ─┴─ Silence (user preference)
```

### 4.2 Context-Aware Volume

#### Time of Day Adjustment

```javascript
const timeMultiplier = {
  '06:00-09:00': 0.8,   // Morning: slightly quieter
  '09:00-18:00': 1.0,   // Workday: normal
  '18:00-22:00': 0.9,   // Evening: slightly reduced
  '22:00-06:00': 0.6,   // Night: significantly quieter
};
```

#### Activity-Based Adjustment

| User State | Volume Modifier | Rationale |
|------------|-----------------|-----------|
| Actively speaking | 0.7x | Don't compete with user |
| In conversation | 1.0x | Normal feedback |
| Idle > 30 seconds | 0.8x | May have stepped away |
| Multiple rapid tasks | 0.6x | Reduce notification fatigue |
| Focus mode enabled | 0.4x | Minimal interruption |

#### Environment Detection

If ambient noise level can be detected:

```
Low ambient (quiet room):    0.8x base volume
Medium ambient (office):     1.0x base volume  
High ambient (noisy):        1.2x base volume (cap at 90%)
```

### 4.3 Volume User Preferences

```yaml
sound_preferences:
  master_volume: 0.7          # 0.0 - 1.0
  
  categories:
    notifications: 1.0        # Relative to master
    state_transitions: 0.8    # Often quieter preferred
    errors: 1.0               # Keep errors audible
    ambient: 0.5              # Background sounds low
    
  mute_options:
    state_sounds: false       # Toggle state transitions
    ambient_sounds: true      # Toggle processing loops
    success_sounds: false     # Toggle completion sounds
    
  time_aware: true            # Enable time-of-day adjustment
  focus_mode: false           # Ultra-minimal sounds
```

### 4.4 Accessibility Considerations

**Hearing Sensitivity**:
- Avoid frequencies > 4kHz as primary tones
- Provide bass reinforcement option (+100-200 Hz undertone)
- Longer attack times for those with hyperacusis

**Hearing Loss Compensation**:
- Option to boost mid frequencies (1-3 kHz)
- Longer duration option (+50%)
- Visual indicator accompaniment option

---

## 5. Sound vs Speech Decision Framework

### 5.1 The Decision Matrix

```
                    LOW COMPLEXITY              HIGH COMPLEXITY
                    (binary outcome)            (nuanced outcome)
                ┌───────────────────────┬───────────────────────┐
                │                       │                       │
    LOW         │     SOUND ONLY        │   SOUND + OPTIONAL    │
    URGENCY     │                       │      SPEECH           │
                │  • Task complete      │  • Analysis done      │
                │  • File saved         │  • Search results     │
                │  • Setting changed    │  • Build warnings     │
                │                       │                       │
                ├───────────────────────┼───────────────────────┤
                │                       │                       │
    HIGH        │   SOUND + BRIEF       │   SOUND + FULL        │
    URGENCY     │     SPEECH            │      SPEECH           │
                │                       │                       │
                │  • "Error"            │  • Connection lost    │
                │  • "Failed"           │  • Test failures      │
                │  • "Cancelled"        │  • Security issues    │
                │                       │                       │
                └───────────────────────┴───────────────────────┘
```

### 5.2 Use Sound When

**Always Sound-Only**:
- Binary outcomes (success/fail with no details needed)
- State transitions user can feel
- Confirmations of routine actions
- Progress ticks during long tasks
- Background task acknowledgments

**Sound Preferred, Speech Optional**:
- Quick task completion
- Non-blocking warnings
- Routine notifications
- State changes during active conversation

### 5.3 Use Speech When

**Always Speech**:
- Errors requiring user decision
- Results user explicitly requested
- Information user cannot infer from context
- First notification after long silence
- Critical system state changes

**Speech Preferred**:
- Task results with metrics ("47 tests passed")
- Errors with actionable details
- Progress updates user is waiting for
- Contextual information about what happened

### 5.4 Decision Flowchart

```
User initiated action?
    │
    ├─ YES: Did it succeed?
    │       │
    │       ├─ YES: Was there output to report?
    │       │       │
    │       │       ├─ YES → Sound + Summary Speech
    │       │       │        "Done. Found 12 results."
    │       │       │
    │       │       └─ NO → Sound Only
    │       │                (Soft Affirm)
    │       │
    │       └─ NO: Is it recoverable?
    │               │
    │               ├─ YES → Sound + Brief Speech
    │               │        "That failed. Want me to retry?"
    │               │
    │               └─ NO → Sound + Full Speech
    │                        "Your session expired. You'll 
    │                         need to reconnect."
    │
    └─ NO (Background/System):
            │
            Is it urgent?
            │
            ├─ YES → Sound + Speech
            │        "Heads up - your build just failed."
            │
            └─ NO: Does user need to know now?
                    │
                    ├─ YES → Sound + Brief Speech
                    │        "Your deploy finished."
                    │
                    └─ NO → Sound Only or Silence
                             (queue for next interaction)
```

### 5.5 Examples by Scenario

| Scenario | Sound | Speech | Rationale |
|----------|-------|--------|-----------|
| User says "save file" → saved | Soft Affirm | None | Binary success, routine |
| User says "run tests" → pass | Satisfied Resolve | "All 47 tests pass" | Metrics add value |
| User says "run tests" → fail | Soft Block | "3 tests failed. Want details?" | Needs decision |
| Background build completes | Triumphant Arrival | "Your build finished" | User was waiting |
| Quick web search done | Soft Affirm | "Found it" | Brief acknowledgment |
| Complex research done | Satisfied Resolve | "Done. I found 5 relevant sources..." | Results need explanation |
| Network hiccup, auto-recovered | None | None | User doesn't need to know |
| Session timeout imminent | Gentle Attention | "We have about 5 minutes left" | Actionable warning |
| Permission denied | Soft Block | "I can't access that file" | Explains blockage |
| Listening activated | Awakening | None | Ambient awareness only |

### 5.6 User Preference Integration

```yaml
speech_preferences:
  verbosity: "balanced"   # minimal | balanced | verbose
  
  # Override defaults
  always_speak:
    - task_complete      # Always announce completions
  never_speak:
    - state_transitions  # No "listening" announcements
    
  # Contextual
  speak_errors: true      # Always explain errors
  speak_warnings: false   # Sound-only for warnings
  speak_progress: "long_tasks_only"  # Only for tasks > 60s
```

---

## 6. Technical Specifications

### 6.1 Audio Format Requirements

```yaml
format:
  type: WAV or OGG (for web)
  sample_rate: 44100 Hz
  bit_depth: 16-bit
  channels: Mono (stereo optional)
  
compression:
  ogg_quality: 6-8 (good balance)
  mp3_bitrate: 128kbps minimum
  
file_sizes:
  short_sounds: < 20KB
  medium_sounds: < 50KB
  ambient_loops: < 200KB
```

### 6.2 Playback Implementation

```typescript
interface SoundConfig {
  id: string;
  file: string;
  baseVolume: number;       // 0.0 - 1.0
  category: 'notification' | 'state' | 'ambient' | 'error';
  allowOverlap: boolean;    // Can play while another sound plays
  priority: number;         // Higher = plays over lower priority
  fadeIn?: number;          // ms
  fadeOut?: number;         // ms
}

interface PlaybackOptions {
  volumeMultiplier?: number;
  interrupt?: boolean;      // Stop current sound
  onComplete?: () => void;
}
```

### 6.3 Sound Scheduling

```typescript
// Debounce rapid-fire sounds
const DEBOUNCE_MS = 100;

// Don't play same sound within window
const DEDUPE_WINDOW_MS = 500;

// Maximum concurrent sounds
const MAX_CONCURRENT = 3;

// Priority queue for overlapping requests
// Higher priority interrupts lower
const PRIORITY = {
  critical_error: 100,
  error: 80,
  completion: 60,
  state_transition: 40,
  ambient: 20,
};
```

### 6.4 Preloading Strategy

```typescript
// Preload on session start
const PRELOAD_IMMEDIATE = [
  'awakening',      // State sounds used immediately
  'received',
  'soft_affirm',    // Common success
  'soft_block',     // Common error
];

// Preload after initial load
const PRELOAD_DEFERRED = [
  'satisfied_resolve',
  'triumphant_arrival',
  'gentle_attention',
  'urgent_attention',
];

// Load on demand
const LOAD_ON_DEMAND = [
  'thinking_loop',  // Only if user enables
];
```

---

## 7. Sound Library Reference

### 7.1 Complete Sound Inventory

| ID | Name | Category | Duration | Default Volume |
|----|------|----------|----------|----------------|
| `ntf_success_quick` | Soft Affirm | notification | 200ms | 60% |
| `ntf_success_medium` | Satisfied Resolve | notification | 500ms | 70% |
| `ntf_success_long` | Triumphant Arrival | notification | 1000ms | 75% |
| `ntf_warning` | Gentle Attention | notification | 250ms | 65% |
| `ntf_error` | Soft Block | notification | 400ms | 70% |
| `ntf_critical` | Urgent Attention | notification | 600ms | 80% |
| `state_listening` | Awakening | state | 150ms | 50% |
| `state_received` | Received | state | 200ms | 55% |
| `state_thinking` | Thinking Loop | ambient | 3000ms | 30% |
| `state_speaking` | Ready to Speak | state | 120ms | 45% |
| `state_idle` | Complete | state | 250ms | 50% |
| `tool_start` | Action Initiated | state | 120ms | 45% |
| `tool_done` | Action Done | state | 175ms | 50% |
| `bg_start` | Background Engaged | state | 400ms | 55% |
| `bg_progress` | Checkpoint | state | 100ms | 35% |

### 7.2 Sound Design Notes for Production

**General Characteristics**:
- All sounds should feel like they belong to the same "family"
- Consistent reverb/room character (small room, warm)
- Avoid harsh high frequencies
- Natural decay preferred over electronic cut-off

**Recommended Sound Sources**:
- Marimba/xylophone (warm wood tones)
- Soft bells/chimes
- Guitar harmonics
- Kalimba/thumb piano
- Soft synth pads (for ambient)

**Sounds to Avoid**:
- Sharp electronic beeps
- Harsh synthesizer tones
- Notification sounds from other products
- Anything that could be mistaken for phone/system alerts
- Startling or anxiety-inducing tones

### 7.3 Testing Checklist

Before finalizing any sound:

- [ ] Audible but not jarring at 50% system volume
- [ ] Distinguishable from other sounds in the library
- [ ] Sounds good on laptop speakers
- [ ] Sounds good on headphones
- [ ] Sounds good on external speakers
- [ ] Not annoying after hearing 50 times in succession
- [ ] Doesn't clash with speech when played together
- [ ] Conveys intended emotional meaning
- [ ] Works in quiet environment
- [ ] Works in moderately noisy environment

---

## Appendix A: Implementation Checklist

### MVP Sound Set (8 sounds)

- [ ] `ntf_success_quick` - Basic task success
- [ ] `ntf_error` - Error occurred
- [ ] `state_listening` - Mic activated
- [ ] `state_received` - Input captured
- [ ] `state_speaking` - Response starting
- [ ] `state_idle` - Turn complete
- [ ] `tool_start` - Tool executing
- [ ] `tool_done` - Tool finished

### Phase 2 Additions

- [ ] `ntf_success_medium` - Medium task success
- [ ] `ntf_success_long` - Long task success
- [ ] `ntf_warning` - Warning notification
- [ ] `ntf_critical` - Critical alert
- [ ] `bg_start` - Background task started
- [ ] `bg_progress` - Progress tick

### Phase 3 (Optional)

- [ ] `state_thinking` - Ambient processing loop
- [ ] Additional variants for preference options

---

## Appendix B: Related Documents

- [01-ux-interaction-ideas.md](./01-ux-interaction-ideas.md) - Audio progress indicators concept
- [12-conversation-state-machine.md](./12-conversation-state-machine.md) - State definitions
- [13-notification-patterns.md](./13-notification-patterns.md) - Notification philosophy

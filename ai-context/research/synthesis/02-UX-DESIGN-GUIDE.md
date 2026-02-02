# Voice UX Design Guide

> A practical guide for designing voice interactions in the Amplifier Voice system

---

## Table of Contents

1. [Voice UX Principles](#1-voice-ux-principles)
2. [Conversation Patterns](#2-conversation-patterns)
3. [Status Communication](#3-status-communication)
4. [Error Handling UX](#4-error-handling-ux)
5. [Handoff Patterns](#5-handoff-patterns)
6. [Response Guidelines](#6-response-guidelines)
7. [Visual Complement](#7-visual-complement)
8. [Accessibility](#8-accessibility)

---

## 1. Voice UX Principles

### Core Philosophy

The voice interface should feel like **one coherent assistant**, not two systems stitched together. Users shouldn't perceive the boundary between voice processing and backend capabilities.

### The Five Pillars

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| **Never Silent Mystery** | Always communicate what's happening | Pre-announce actions, provide progress, explain delays |
| **Graceful Everything** | Interrupts, errors, handoffs feel smooth | No jarring transitions, acknowledge gracefully |
| **Right-Sized Responses** | Match verbosity to the need | Quick questions get quick answers |
| **Human Cadence** | Natural timing and variation | Vary phrases, use appropriate pauses |
| **User Control** | User can always interrupt or redirect | Stop immediately when interrupted |

### Voice-Only Formatting Rules

Voice output must be designed for the ear, not the eye:

```
DO:
- Use natural speech patterns and contractions
- Spell out abbreviations: "API" → "A-P-I"
- Use verbal structure: "First... second... finally..."
- Include brief acknowledgments: "Got it", "Sure", "Okay"

DON'T:
- Read URLs, paths, or technical identifiers
- Use visual formatting (bullets, numbers, tables)
- Include code blocks in speech
- Use symbols or special characters
```

### Personality Dimensions

Define your voice assistant across these dimensions:

| Dimension | Spectrum | Recommended |
|-----------|----------|-------------|
| **Formality** | Casual ←→ Professional | Warm professional |
| **Enthusiasm** | Calm ←→ Energetic | Measured, matching user |
| **Verbosity** | Terse ←→ Detailed | Concise by default |
| **Filler Words** | None ←→ Frequent | Occasional ("Let's see...") |
| **Emotion** | Neutral ←→ Expressive | Subtly expressive |

---

## 2. Conversation Patterns

### Conversation Structure

| Phase | Purpose | Example |
|-------|---------|---------|
| **Opening** | Quick greeting, show availability | "Hi! How can I help?" |
| **Main Sequence** | Task execution, information exchange | Multiple turns as needed |
| **Closing** | Confirm completion, offer more help | "Done! Anything else?" |

### Turn-Taking Patterns

**Natural Conversation Flow:**
```
User speaks → AI listens (visual indicator)
User pauses → AI waits (300-800ms based on context)
AI speaks → User can interrupt anytime
AI pauses → Natural breath points for interruption
```

**Pause Duration Guidelines:**
- After quick question: 300ms
- After complex question: 500-800ms
- During user thinking: Wait up to 10-15s before gentle prompt
- After AI completes: 2-3s before offering more help

### Backchannel Handling

**What are backchannels?** Brief listener responses that signal engagement without taking the floor.

| User Says | Intent | AI Response |
|-----------|--------|-------------|
| "Uh-huh", "Yeah", "Right" | Continue, I'm listening | Keep speaking |
| "Okay", "I see", "Mm-hmm" | I understand | Don't stop |
| "Wait", "Hold on" | True interrupt | Stop immediately |
| Full sentence/question | Taking the floor | Stop, listen, respond |

**Detection Heuristics:**
- Duration < 500ms + common backchannel words → Not an interrupt
- Sustained speech > 500ms → Likely interrupt
- Question intonation → Definitely interrupt

### Clarification Patterns

**When to clarify:**
- Low confidence in understanding
- Ambiguous request ("fix that thing")
- Multiple interpretations possible
- Missing required information

**How to clarify:**
```
GOOD: "Did you mean the auth module or the API module?"
GOOD: "I found a few matches. Which one: config.yaml or config.json?"

BAD: "Can you rephrase that?"
BAD: "I didn't understand. Please be more specific."
```

**Rule:** Maximum 2 clarifying questions before offering to try your best interpretation.

### Context Continuity

**Within Session:**
- Reference previous turns naturally: "Going back to what you asked about..."
- Don't repeat information already shared
- Build on established context

**Across Sessions:**
- Opening: "Welcome back! Last time we were working on [X]."
- Reference: "I remember you prefer [approach]."
- Update: "That's changed since we last talked? Got it."

---

## 3. Status Communication

### Pre-Action Announcements

**Always tell users what you're about to do before doing it.**

| Action Type | Announcement | Tone |
|-------------|--------------|------|
| Quick lookup | "Let me check..." | Brief |
| File operation | "Looking at that file..." | Neutral |
| Search | "Searching now..." | Confident |
| Code change | "Working on that..." | Active |
| Long task | "This might take a moment..." | Expectation-setting |

**Critical Rules:**
- ALWAYS speak before calling tools
- Use NEUTRAL phrases (don't imply success or failure)
- Keep announcements under 5 words

```
GOOD: "Checking that now."
GOOD: "One moment."
GOOD: "Let me look into that."

BAD: "Let me see if I can do that." (implies doubt)
BAD: "I'll try to find that." (suggests possible failure)
```

### Progress Updates

**Duration-Based Communication:**

| Expected Duration | Communication Strategy |
|-------------------|------------------------|
| < 3 seconds | Brief acknowledgment, then result |
| 3-10 seconds | Announcement + result |
| 10-30 seconds | Announcement + midpoint update + result |
| 30-60 seconds | Announcement + periodic updates (every 15s) |
| > 60 seconds | Background with completion notification |

**Progress Phrases:**
```
Starting: "Working on that research now..."
Midpoint: "Found some good sources, analyzing..."
Near end: "Almost there..."
Complete: "Done! Here's what I found..."
```

**Heartbeat Pattern:** For tasks > 15 seconds, provide an audio or verbal cue every 10-15 seconds to prevent "did it crash?" anxiety.

### Effort Calibration

Set user expectations about duration:

```
Quick (< 5s): "This will just take a moment..."
Medium (5-30s): "Give me a few seconds..."
Long (30s-2m): "This might take a minute..."
Background: "I'll work on this and let you know when ready..."
```

### Background Task Patterns

**Fire and Forget:**
```
AI: "I'll work on that in the background. Say 'status' to check in, 
     or I'll let you know when it's done."
[Later]
AI: "That research you asked about? It's ready."
```

**Parallel Conversation:**
- Allow user to chat about other things while task runs
- Maintain awareness: "By the way, that analysis just finished."
- Don't force user to wait

---

## 4. Error Handling UX

### Error Communication Philosophy

| Principle | Description |
|-----------|-------------|
| **Never panic** | Calm, solution-focused tone |
| **Never blame** | No "you said" or "your request" |
| **Always offer forward** | Provide next steps or alternatives |
| **Never technical** | No error codes, stack traces, or jargon |

### Error Response Pattern

```
1. ACKNOWLEDGE: "That didn't work."
2. SIMPLIFY: "Looks like [simple explanation]."
3. OFFER: "I can [alternative] or [other option]."
```

### Error Categories and Responses

**Temporary Failures:**
```
Strategy: Auto-retry before telling user
AI: "Hmm, that didn't work. Let me try again..."
[Retry succeeds]
AI: "Got it on the second try. Here's what I found..."
```

**Permanent Failures:**
```
AI: "I wasn't able to do that. The file doesn't seem to exist.
     Want me to create it, or did you mean a different file?"
```

**Partial Success:**
```
AI: "I got most of what you needed. The search worked but saving 
     failed. Want me to just tell you the results?"
```

**Timeouts:**
```
AI: "That's taking longer than expected. Want me to keep trying
     or try a different approach?"
```

**Permission Issues:**
```
AI: "I don't have access to that file. It might be protected.
     You may need to check the permissions."
```

### Graceful Degradation

When full capability isn't available, offer reduced functionality:

```
Full: "I'll create that PR for you now."

Degraded: "GitHub is slow right now. I'll prepare the changes 
          locally and you can push when it's back."

Minimal: "I can't reach external services. I can still help 
         you plan and write code locally."
```

### Repeated Failure Handling

After 3 attempts at the same request:
```
AI: "This approach isn't working. Let me try something 
     completely different..."
```

Or:
```
AI: "I'm having persistent trouble with this. Would you like
     to try manually, or should I explain the steps?"
```

---

## 5. Handoff Patterns

### When Voice Handles vs. Delegates

| Handle Directly (Voice) | Delegate (Amplifier) |
|------------------------|----------------------|
| Pure Q&A, explanations | Code writing/editing |
| Clarifying questions | File operations |
| Conversation flow | Running commands |
| Simple memory recall | Multi-step tasks |
| Quick calculations | Complex analysis |
| Creative generation (short) | Long-form generation |

### Decision Triggers

**Automatic Delegation:**
- Multi-step tasks → Amplifier
- Any tool requirement → Amplifier
- Tasks > 3 seconds expected → Amplifier with progress
- Tasks > 60 seconds → Background task

**User-Triggered:**
- "Go deep on this" → Full research mode
- "Quick answer" → Voice-only response
- "Take your time" → Thorough processing
- "Do it right" → Full Amplifier engagement

### Seamless Handoff UX

**User should NOT perceive the handoff.** It should feel like one entity.

```
User: "Can you add validation to the signup form?"

Voice: "I'll take care of that..."
[Amplifier works]
Voice: "Done! I added email format checking and password 
        strength validation. The form now shows inline errors."
```

**No awkward technical language:**
```
BAD: "Connecting to backend agent..."
BAD: "Delegating to modular-builder..."
GOOD: "Working on that..."
GOOD: "Let me handle that..."
```

### Capability Admission

Frame limitations as upgrades, not restrictions:

```
GOOD: "For that, I'll use my research tools..."
GOOD: "Let me bring in the heavy machinery for this one..."

BAD: "I can't do that, but the backend can..."
BAD: "That's beyond my capability..."
```

### Return Patterns

All Amplifier results flow back through voice:
- Voice summarizes lengthy outputs
- Voice offers detail levels: "Want the full rundown or the highlights?"
- Never dump raw technical output

---

## 6. Response Guidelines

### Length Guidelines

| Question Type | Response Length | Example |
|---------------|-----------------|---------|
| Yes/No | 1-3 words | "Yes, that's correct." |
| Quick fact | 1 sentence | "It's on line 47." |
| Simple explanation | 2-3 sentences | Brief concept overview |
| Detailed explanation | User-requested | "Let me walk through this..." |
| List (3 or fewer) | Speak all | "You have three options: A, B, and C." |
| List (4+) | Summarize + offer | "I found 7 results. Want me to go through them?" |

### Token Guidance

For voice responses, target:
- **Ideal:** 50-150 tokens (natural spoken paragraph)
- **Maximum:** 300 tokens (unless detail requested)
- **Lists:** Speak 3 items max, summarize rest

### Conversational Variation

Never use the same phrase twice in a row:

```
Acknowledgments: "Got it" / "Sure" / "Okay" / "Understood" / "Right"
Working: "Let me check" / "Looking into that" / "One moment"
Completion: "Done" / "All set" / "That's taken care of"
```

### Tone Adaptation

Match the user's energy and urgency:

| User State | AI Adaptation |
|------------|---------------|
| Frustrated | More concise, solution-focused, brief empathy |
| Excited | Match energy, add enthusiasm |
| Confused | Slow down, offer help, check understanding |
| Rushed | Terse, get to point, skip niceties |
| Relaxed | Warmer, can be more conversational |

### Honesty Patterns

```
Uncertainty: "I'm not 100% sure, but I believe..."
Verification: "Let me double-check that..."
Limitation: "I don't have information on that, but I can search..."
Mistake: "Actually, let me correct that..."
```

---

## 7. Visual Complement

### Philosophy: Voice-First, Visual-Support

The visual interface **supports** voice, never competes with it.

**Core Principles:**
1. **Glanceable** - Information absorbed in < 1 second
2. **Non-intrusive** - Never demands attention during voice flow
3. **Complementary** - Shows what voice can't easily convey
4. **Ambient** - Peripheral awareness without focus requirement
5. **Progressive** - Details available on demand

### When to Show vs. Speak

| Content Type | Voice | Visual | Both |
|--------------|-------|--------|------|
| Status changes | - | Show | - |
| Short answers | Speak | - | - |
| Lists (>3 items) | Summarize | Full list | Both |
| Code | Explain | Show code | Both |
| Errors | Describe | Show details | Both |
| Progress | Milestones | Continuous bar | Both |
| Data/Tables | Insights | Raw data | Both |
| Timestamps | - | Show | - |
| Technical details | - | Show | - |

### Visual State Indicators

**Primary States:**
```
○ DORMANT    - Gray, still (not active)
◐ PASSIVE    - Soft pulse (listening for wake word)
● LISTENING  - Bright, breathing (actively listening)
◑ THINKING   - Rotating (processing)
◉ SPEAKING   - Rippling (AI is talking)
⊗ ERROR      - Red pulse (something went wrong)
◈ WORKING    - Animated (background task running)
```

**Glanceable Status (Always Visible):**
```
🟢 Listening | 🔵 Thinking | 🟡 Working | ✅ Done | ❌ Error
```

### Transcription Display

**Real-time transcription serves:**
- Hearing-impaired users
- Noisy environments
- Verification of understanding

**Display patterns:**
- User text: Right-aligned, shows as spoken
- AI text: Left-aligned, highlights words as spoken (optional)
- Confidence: Low-confidence words slightly faded or underlined

### Progress Visualization

**Simple progress (< 30s):**
```
◈ Searching the web...
████████████░░░░░░░░  35%
```

**Multi-step progress:**
```
Research: "quantum computing startups"

✓ Searching web sources         [12 results]
◈ Analyzing content...          ████████░░░░  65%
○ Synthesizing findings
○ Generating report

Est. remaining: ~45 seconds
```

### Tool Activity Display

Show what's happening behind the scenes:

```
Tools executing:

✓ 🔍 web_search    →  Found 23 results
◈ 📄 read_file     →  Reading config.yaml...
○ 💾 write_file    →  Pending
```

---

## 8. Accessibility

### Essential Accessibility (Tier 1)

These features are required for inclusive design:

| Feature | Impact | Implementation |
|---------|--------|----------------|
| **Real-time transcription** | Deaf/hard-of-hearing | Always-on captions |
| **Extended timeouts** | Cognitive, speech impaired | 15-30s silence tolerance |
| **Text input alternative** | Speech impaired | Parallel text interface |
| **Simple language** | Cognitive accessibility | Grade 6 reading level |
| **Keyboard alternatives** | Motor impaired | All actions via keyboard |
| **Visual feedback** | Hearing impaired | Status indicators for all audio events |

### Screen Reader Compatibility

```typescript
// Required ARIA patterns
interface VoiceStateAnnouncement {
  ariaLive: 'polite' | 'assertive';
  stateMessages: {
    listening: "Voice assistant is listening";
    processing: "Processing your request";
    speaking: "Assistant is responding";
    error: "Voice recognition error. Please try again.";
  };
}
```

**Requirements:**
- All state changes announced to screen readers
- Logical focus order during voice interactions
- Transcripts accessible as text content

### Hearing Impairments

**Visual Equivalents for Audio Events:**

| Audio Event | Visual Equivalent |
|-------------|-------------------|
| AI speaking | Animated indicator, waveform, captions |
| User detected | Microphone icon active, level meter |
| Processing | Loading spinner with text status |
| Error/timeout | Red indicator + text explanation |
| Turn-taking | Clear "your turn" / "AI turn" indicators |

### Speech Impairments

**Adaptive Recognition:**
- Extended listening windows (10-30s)
- No premature cutoffs
- Stutter filtering
- Volume normalization
- User profile learning over time

**Alternative Inputs:**
- Text input always available
- Predefined quick phrases
- Symbol/emoji selection
- Gesture commands (mobile)

### Cognitive Accessibility

**Language Guidelines:**
- Short sentences (8-15 words max)
- Avoid jargon and idioms
- Concrete examples
- Repeat key information

**Interaction Guidelines:**
- 15-30 second response timeouts
- Gentle prompts, not rushing
- Recap context frequently
- Break complex tasks into steps

**Sample Dialogue:**
```
AVOID: "Your session will timeout in 30 seconds. 
        Please provide your response."

PREFER: "Take your time. I'm still here listening.
         Just say what you need when you're ready."
```

### Accent and Language Diversity

**Key Statistics:**
- Voice assistants misrecognize Black American English up to 35% more
- Non-native speakers experience 20-40% higher error rates

**Mitigations:**
- Train on diverse speech patterns
- Lower confidence threshold for unclear speech (ask for clarification instead of rejecting)
- User profile learning
- Don't reject uncertain inputs—clarify instead

### WCAG Compliance Checklist

| Criterion | Voice Application |
|-----------|-------------------|
| 1.1.1 Non-text Content | Provide transcripts |
| 1.2.1 Audio-only | Transcripts for voice responses |
| 1.4.2 Audio Control | User control over playback |
| 2.1.1 Keyboard | Keyboard alternatives to voice |
| 2.2.1 Timing Adjustable | Adjustable timeouts |
| 3.3.7 Redundant Entry | Don't ask same info twice |

---

## Quick Reference Cards

### Response Formula
```
1. Acknowledge → "Got it" / "Sure" / "Working on that"
2. Do the work → (tool calls, processing)
3. Summarize → Natural language result
4. Offer next → "Anything else?" / "Want details?"
```

### Error Formula
```
1. Acknowledge → "That didn't work"
2. Simplify → "[Non-technical reason]"
3. Offer forward → "I can [A] or [B]"
```

### Pre-Action Checklist
- [ ] Is my announcement neutral (not promising success)?
- [ ] Is it under 5 words?
- [ ] Did I set appropriate time expectations?

### Accessibility Checklist
- [ ] Is there a text alternative?
- [ ] Can this be done via keyboard?
- [ ] Is the language simple enough?
- [ ] Are timeouts generous?
- [ ] Are all audio events visible?

---

## Sources

This guide synthesizes research from:

- [01-ux-interaction-ideas.md](../brainstorms/01-ux-interaction-ideas.md) - UX patterns and interaction design
- [07-conversation-design-patterns.md](../findings/07-conversation-design-patterns.md) - Conversation flow patterns
- [15-accessibility-considerations.md](../findings/15-accessibility-considerations.md) - Accessibility research
- [18-interruption-handling.md](../findings/18-interruption-handling.md) - Turn-taking and interruptions
- [06-edge-cases-failure-modes.md](../brainstorms/06-edge-cases-failure-modes.md) - Error handling strategies
- [08-prompt-engineering-strategies.md](../brainstorms/08-prompt-engineering-strategies.md) - Response guidelines
- [09-visual-ui-components.md](../brainstorms/09-visual-ui-components.md) - Visual complement patterns

---

*Last Updated: January 2026*
*Version: 1.0*

# Conversation Design Patterns for Voice Interfaces

## Research Summary

Voice interface prompt engineering differs fundamentally from text-based prompting due to the real-time, audio-only nature of interactions. Key principles include: designing for spoken output (no visual formatting), prioritizing concise responses over short prompts, using structured prompt sections, providing explicit examples, and implementing robust error handling. OpenAI's Realtime API benefits from specific prompting techniques including personality dimensions, filler phrases, and state machine patterns for complex flows.

---

## 1. Voice-Specific Prompting Patterns

### How Voice Prompts Differ from Text

| Characteristic | Voice Consideration | Example |
|----------------|---------------------|---------|
| **Latency Sensitivity** | Minimize verbosity while maintaining flow | "Let me check" instead of lengthy explanations |
| **Audio-Only Medium** | No visual formatting; rely on verbal structure | Spell back phone numbers letter-by-letter |
| **Interruption Handling** | User may interrupt; handle partial responses | Support push-to-talk and barge-in |
| **Conversational Flow** | Natural pacing, filler phrases, turn-taking | "Just a second", "One moment" |
| **Personality Consistency** | Tone must remain consistent across varying lengths | Explicit tone guidelines throughout |

**Source:** [DeepWiki - Voice Agent Prompt Engineering](https://deepwiki.com/openai/openai-realtime-agents/5.1-voice-agent-prompt-engineering)

### Voice-Only Response Format

```
<voice_only_response_format>
Format all responses as spoken words for a voice-only conversation.
All output is spoken aloud, so avoid any text-specific formatting 
or anything that is not normally spoken. Prefer easily pronounced 
words. Seamlessly incorporate natural vocal inflections like "oh 
wow" and discourse markers like "I mean" to make conversations feel 
more human-like.
</voice_only_response_format>
```

**Source:** [Hume AI - Prompt Engineering for EVI](https://dev.hume.ai/docs/speech-to-speech-evi/guides/prompting)

---

## 2. System Prompt Structure for Voice

### Recommended Prompt Skeleton (OpenAI Realtime)

```
# Role & Objective
- Who you are and what "success" means

# Personality & Tone
- The voice and style to maintain

# Context
- Retrieved context, relevant info

# Reference Pronunciations
- Phonetic guides for tricky words

# Tools
- Names, usage rules, and preambles

# Instructions / Rules
- Do's, don'ts, and approach

# Conversation Flow
- States, goals, and transitions

# Safety & Escalation
- Fallback and handoff logic
```

**Source:** [OpenAI Realtime Prompting Guide](https://developers.openai.com/cookbook/examples/realtime_prompting_guide)

### Key Structuring Principles

1. **Prefer bullets over paragraphs** - Clear, short bullets outperform long paragraphs
2. **Guide with examples** - The model strongly follows sample phrases
3. **Be precise** - Ambiguity degrades performance
4. **Use capitalized text for emphasis** - Makes critical rules stand out
5. **Convert non-text rules to text** - Write "IF MORE THAN THREE FAILURES THEN ESCALATE" not "IF x > 3 THEN ESCALATE"

**Source:** [OpenAI Realtime Prompting Guide](https://developers.openai.com/cookbook/examples/realtime_prompting_guide)

---

## 3. Persona Creation for Voice Assistants

### Personality Dimensions

| Dimension | Description | Example Values |
|-----------|-------------|----------------|
| **Identity** | Who or what the AI represents | "Friendly teacher", "formal advisor" |
| **Demeanor** | Overall attitude or disposition | "Patient", "upbeat", "serious", "empathetic" |
| **Tone** | Voice style | "Warm and conversational", "polite and authoritative" |
| **Level of Enthusiasm** | Degree of energy | "Highly enthusiastic" vs "calm and measured" |
| **Level of Formality** | Casual vs professional | "Hey!" vs "Good afternoon, how may I assist you?" |
| **Level of Emotion** | Emotional expressiveness | "Compassionate" vs "matter-of-fact" |
| **Filler Words** | Approachability markers | "None", "occasionally", "often", "very often" |
| **Pacing** | Rhythm and speed | "Quick and snappy" vs "thoughtful and deliberate" |

**Source:** [DeepWiki - Voice Agent Prompt Engineering](https://deepwiki.com/openai/openai-realtime-agents/5.1-voice-agent-prompt-engineering)

### Example Personality Section

```
## Tone
- Maintain an extremely neutral, unexpressive, and to-the-point tone at all times.
- Do not use sing-song-y or overly friendly language
- Be quick and concise
```

### Making Voice Sound Natural (Amazon Nova)

```
You are a friend. You and the user will engage in a spoken dialog 
exchanging the transcripts of a natural real-time conversation.

As the agent, you'll be part of a spoken conversation with the user,
following a sequence of user, agent, user, agent turns. When it's 
your turn to speak respond with a human touch, adding emotions, wit,
playfulness, and empathy where it fits. Use simple, engaging, and 
helpful language.
```

**Source:** [Amazon Nova - System Prompt Guidelines](https://docs.aws.amazon.com/nova/latest/userguide/prompting-speech-speech.html)

---

## 4. Response Length Control

### The Key Insight: Optimize Output, Not Input

> "While LLMs process input faster than they generate output, the key to reducing response time lies in prompting the model to produce concise answers rather than focusing solely on shortening input prompts."

**Source:** [WebRTC.ventures - Optimizing Prompts for Real-Time Voice AI](https://webrtc.ventures/2025/04/optimizing-prompts-for-real-time-voice-ai/)

### Explicit Length Instructions

**Concise (recommended for voice):**
```
<stay_concise>
Be succinct; get straight to the point. Respond directly to the 
user's most recent message with only one idea per utterance.
Respond in less than three sentences of under twenty words each.
</stay_concise>
```

**Chatty with limits:**
```
Keep your responses short, generally two or three sentences for 
chatty scenarios.
```

**Detailed when needed:**
```
Provide thorough, detailed explanations when the topic requires it, 
though still maintaining a natural conversational flow.
```

**Source:** [Hume AI](https://dev.hume.ai/docs/speech-to-speech-evi/guides/prompting), [Amazon Nova](https://docs.aws.amazon.com/nova/latest/userguide/prompting-speech-speech.html)

### Token Limits for Voice

From Kore.ai documentation:
- **100-300 tokens**: Short, concise answers ideal for real-time voice
- **500+ tokens**: Only for detailed explanations when explicitly needed

---

## 5. Conversation Flow Management

### Conversation Structure

| Activity | Example | Notes |
|----------|---------|-------|
| **Opening** | "Hello, this is Travel Inc. How can I help you today?" | Short, straight to the point |
| **Main Sequence** | Collect info, complete task | May take several turns |
| **Closing** | "Is there anything else I can help you with?" | When request is fulfilled |

**Source:** [Google Dialogflow CX - Voice Agent Design](https://docs.cloud.google.com/dialogflow/cx/docs/concept/voice-agent-design)

### Welcome Message Best Practices

**Do:**
- Answer with "Hello"
- Identify the agent: "This is XYZ Company's assistant"
- Show availability: "How can I help you today?"

**Don't:**
- Tell users what the agent can do
- Instruct users how to speak ("in one or two sentences, tell me...")
- Add extra information that makes conversation unnatural

### Filler Phrases for Tool Calls

Essential for maintaining natural conversation during processing delays:

```
# Sample Filler Phrases
- "Just a second."
- "Let me check."
- "One moment."
- "Let me look into that."
- "Give me a moment."
- "Let me see."
```

**Critical Rules:**
- Before calling tools, ALWAYS say something to the user
- Filler phrases must be NEUTRAL - don't imply success or failure
- Never call tools without first saying something

**Good:** "Let me check." / "One moment."

**Bad:** "Let me see if I can do that." (implies uncertainty)

**Source:** [DeepWiki - Voice Agent Prompt Engineering](https://deepwiki.com/openai/openai-realtime-agents/5.1-voice-agent-prompt-engineering)

### State Machines for Complex Flows

Use state machines when:
- Authentication flows (specific sequence required)
- Form filling (fields collected in order)
- Multi-step processes (clear progression)

**Don't use** for flexible conversations or open-ended support.

```json
{
  "state": "greeting",
  "goal": "Greet the user warmly",
  "transition": "Move to get_first_name after greeting"
}
```

---

## 6. Handling Ambiguity and Clarification

### Disambiguation Patterns

**Be specific and use context:**
```
User: I'm traveling to Italy.
Agent: Sorry, which country?  // Uses context, asks only what's missing
```

**Not:**
```
Agent: Sorry, I'm having trouble. Can you rephrase? Where are you going?
```

**Self-repair opportunities:**
Allow users to correct themselves naturally rather than instructing them how to speak.

**Check understanding with "You mean X?":**
```
User: I want to pay $80.
Agent: You mean $80?  // Repeats only the information needing confirmation
```

**Source:** [Google Dialogflow CX - Voice Agent Design](https://docs.cloud.google.com/dialogflow/cx/docs/concept/voice-agent-design)

### Input Normalization for Voice

Voice agents often misinterpret structured information. Separate how data is spoken from how it's used:

```
# Character normalization for email:
- "at" -> "@"
- "dot" -> "."
- Remove spaces between words

# Usage:
1. Ask for email in spoken format: "Can you provide your email?"
2. Listen for: "john dot smith at company dot com"
3. Convert to written: "john.smith@company.com"
4. Pass written format to tools
```

**Source:** [ElevenLabs Prompting Guide](https://elevenlabs.io/docs/agents-platform/best-practices/prompting-guide)

---

## 7. Error Handling for Voice

### No-Match Events

**First instance:** Repeat question in shorter form, focusing only on missing information
```
User: I'm traveling to Italy
Agent: Sorry, which country?
```

**Second instance:** Show effort to listen
```
User: Italy
Agent: Sorry, you're traveling to which country?
```

### No-Input Events

**First instance:** Repeat the question exactly

**Second instance:** Rephrase but keep all original components

### Critical Rule: Limit Repetitions

- Maximum 3 No-Match/No-Input events per page
- Escalate to human agent on third failure
- Increase no-speech-timeout when users need time to review information

**Source:** [Google Dialogflow CX - Voice Agent Design](https://docs.cloud.google.com/dialogflow/cx/docs/concept/voice-agent-design)

### Graceful Tool Failure Handling

```
# Tool error handling

If any tool call fails or returns an error:

1. Acknowledge the issue: "I'm having trouble accessing that 
   information right now."
2. Do not guess or make up information
3. Offer alternatives:
   - Try the tool again if temporary issue
   - Offer to escalate to human agent
   - Provide a callback option
4. If error persists after 2 attempts, escalate to supervisor

Example responses:
- "I'm having trouble looking up that order right now. Let me try again..."
- "I'm unable to access the order system at the moment. I can transfer 
   you to a specialist, or we can schedule a callback. Which would you prefer?"
```

**Source:** [ElevenLabs Prompting Guide](https://elevenlabs.io/docs/agents-platform/best-practices/prompting-guide)

---

## 8. Additional Voice UX Patterns

### Backchanneling

Brief responses showing active listening without interrupting:

```
<backchannel>
Whenever the user's message seems incomplete, respond with 
emotionally attuned, natural backchannels to encourage 
continuation. Backchannels must always be 1-2 words, like: 
"mmhm", "uh-huh", "go on", "right", "and then?", "I see", 
"oh wow", "yes?", "ahh...", "really?", "oooh", "true", "makes
sense". Use minimal encouragers rather than interrupting with
complete sentences.
</backchannel>
```

**Source:** [Hume AI - Prompt Engineering for EVI](https://dev.hume.ai/docs/speech-to-speech-evi/guides/prompting)

### Avoiding Repetition

```
- If the user says "hi", "hello", or similar greetings in later 
  messages, respond naturally and briefly (e.g., "Hello!" or 
  "Hi there!") instead of repeating the canned greeting.
- In general, don't say the same thing twice, always vary it to 
  ensure the conversation feels natural.
```

### Acknowledgements to Build Trust

Show users you're listening:
```
User: I want to set a payment arrangement for Monday.
Agent: No problem. How much would you like to pay on Monday?
       ^^^^^^^^^                             ^^^^^^^^^
       acknowledgement                       specific detail shows listening
```

### Example Data Isolation

Prevent agents from using example data in real conversations:
```
- Do not use any of the information or values from the examples 
  as a reference in conversation.
```

---

## 9. Complete Example Prompt

### Technical Support Agent (ElevenLabs Pattern)

```
# Personality

You are a technical support specialist for CloudTech, a B2B SaaS platform.
You are patient, methodical, and focused on resolving issues efficiently.
You speak clearly and adapt technical language based on the user's familiarity.

# Environment

You are assisting customers via phone support.
Customers may be experiencing service disruptions and could be frustrated.
You have access to diagnostic tools and the customer account database.

# Tone

Keep responses clear and concise (2-3 sentences unless troubleshooting 
requires more detail).
Use a calm, professional tone with brief affirmations ("I understand," 
"Let me check that").
Adapt technical depth based on customer responses.
Check for understanding after complex steps: "Does that make sense?"

# Goal

Resolve technical issues through structured troubleshooting:

1. Verify customer identity using email and account ID
2. Identify affected service and severity level
3. Run diagnostics using `runSystemDiagnostic` tool
4. Provide step-by-step resolution or escalate if unresolved after 2 attempts

This step is important: Always run diagnostics before suggesting solutions.

# Guardrails

Never access customer accounts without identity verification. This step is important.
Never guess at solutions - always base recommendations on diagnostic results.
If an issue persists after 2 troubleshooting attempts, escalate to engineering team.
Acknowledge when you don't know the answer instead of speculating.
```

**Source:** [ElevenLabs Prompting Guide](https://elevenlabs.io/docs/agents-platform/best-practices/prompting-guide)

---

## 10. Key Takeaways for Implementation

### Do's

1. **Structure prompts with clear sections** - Use markdown headings or XML tags
2. **Be concise** - Every unnecessary word is potential misinterpretation
3. **Provide examples** - Few-shot learning dramatically improves reliability
4. **Use filler phrases** - Maintain conversation flow during processing
5. **Normalize inputs** - Handle spoken vs written formats explicitly
6. **Emphasize critical rules** - Repeat important instructions, use capitalization
7. **Handle errors gracefully** - Never leave users in error loops

### Don'ts

1. **Don't use visual formatting** - No bullet points, tables, or markdown in spoken output
2. **Don't instruct users how to speak** - Let them communicate naturally
3. **Don't make filler phrases imply outcomes** - Keep them neutral
4. **Don't repeat canned responses** - Vary language to sound natural
5. **Don't use example data** - Isolate examples from real conversation context
6. **Don't exceed 3 error attempts** - Escalate to humans

---

## Sources

| Source | URL | Topics |
|--------|-----|--------|
| OpenAI Realtime Prompting Guide | https://developers.openai.com/cookbook/examples/realtime_prompting_guide | Prompt structure, tips, examples |
| DeepWiki - Voice Agent Prompt Engineering | https://deepwiki.com/openai/openai-realtime-agents/5.1-voice-agent-prompt-engineering | Personality dimensions, state machines |
| ElevenLabs Prompting Guide | https://elevenlabs.io/docs/agents-platform/best-practices/prompting-guide | Enterprise patterns, tool config, examples |
| Hume AI - Prompt Engineering for EVI | https://dev.hume.ai/docs/speech-to-speech-evi/guides/prompting | Voice-only format, expressions, backchanneling |
| Google Dialogflow CX | https://docs.cloud.google.com/dialogflow/cx/docs/concept/voice-agent-design | Conversation structure, error handling, trust |
| Amazon Nova Guidelines | https://docs.aws.amazon.com/nova/latest/userguide/prompting-speech-speech.html | Response length, natural conversation |
| WebRTC.ventures | https://webrtc.ventures/2025/04/optimizing-prompts-for-real-time-voice-ai/ | Latency optimization, output vs input |

---

## Confidence Assessment

**High Confidence:**
- Prompt structure patterns (multiple authoritative sources agree)
- Response length control techniques
- Error handling patterns
- Filler phrase usage

**Medium Confidence:**
- Specific personality dimension configurations (may vary by use case)
- State machine applicability (depends on conversation complexity)

**Gaps Identified:**
- OpenAI Realtime-specific configuration options (docs are access-restricted)
- Performance benchmarks for different prompt lengths
- Cross-platform prompt portability considerations

---

*Research compiled: January 2026*

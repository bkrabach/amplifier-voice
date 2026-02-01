# Voice AI User Onboarding Research

## Research Summary

Voice AI onboarding presents unique challenges compared to visual interfaces due to the absence of visual cues, the "discoverability problem" (users don't know what they can say), and the need to build user confidence through early successes. Best practices center on gamification principles, progressive disclosure, graceful error recovery, and establishing trust through consistent, helpful interactions from the first moment.

---

## 1. First-Time User Experience for Voice

### The Core Challenge

Unlike visual interfaces with buttons and menus, voice interfaces provide no inherent affordances. Users face a "blank canvas" and often don't know how to begin or what's possible. Research shows that frustration in early interactions leads to abandonment - users may never return after a failed first experience.

### Key Principles

#### Make First Interactions Easy and Successful
From SoundHound's research on gamifying voice onboarding:
> "Frustration is the adversary to motivation. People don't want to feel like failures and when they do, they may blame the voice assistant."

The first interaction should be:
- **Simple enough that a child could figure it out** - Push a button or utter a wake word and interaction starts immediately
- **Guided with suggestions** - When users stumble, suggest something simple: "You can ask me to turn on the lights or navigate to your destination"
- **Designed for quick wins** - Success with the first interaction provides reassurance that using the assistant is simple

#### Welcome Experience Design (Amazon Alexa Best Practices)

**Do - For new users:**
```
User: "Alexa, Open MySkill."
Alexa: "Welcome to MySkill. Looks like this is your first visit. I'll explain 
a couple things you can do and keep in mind, you can ask for 'help' any time 
for assistance. MySkill can provide info on best practices, suggestions on 
how to do things and much more. What would you like to do?"
```

**Don't:**
```
User: "Alexa, Open MySkill."
Alexa: "What would you like to do?"
```

**Do - For returning users:**
```
User: "Alexa, Open MySkill."
Alexa: "Welcome back to MySkill. It's good to see you again. What would you 
like to do this visit?"
```

A welcome prompt reinforces that users correctly invoked the desired skill and are in a skill experience. Generic questions like "What would you like to do?" without context cause confusion.

#### Behavioral Science Foundation (Fogg Behavior Model)

Three conditions required for desired behavior:
1. **Motivation** - Make interactions rewarding
2. **Ability** - Keep tasks simple and achievable
3. **Prompt** - Provide clear triggers for action

> "If the task is too hard and people get frustrated, they won't return."

### Autonomy and Control

Research shows the #1 contributor to overall happiness is the sense of autonomy and feeling in control. In voice applications:
- Allow users to ask for things the same way they would talk to another human
- Provide multi-modal interfaces (voice-first, not voice-only)
- Let users choose their interaction style

---

## 2. Teaching Users What Voice Can Do (Discoverability)

### The Discoverability Problem

From ACM research "What Can I Say?":
> "Discoverability, the ability for users to find and execute features through a user interface, is a recurrent problem with Voice User Interface (VUI) design that makes it difficult for users to understand what commands are supported by a newly encountered system."

Key insight from Voicebot.ai:
> "Discoverability is a problem - if you build it, they will not necessarily come. And if they don't come, you won't build it... so how do we solve Voice's version of the chicken and egg?"

### Strategies for Teaching Capabilities

#### 1. Don't "Teach Commands" - Speaking is Intuitive

From Google's VUI Design Principles:
> "One of my pet peeves is emblematic of amateur VUI design: 'teaching' users how to speak... The whole point, the real benefit, of offering the public a VUI is that speech is intuitive; it doesn't need to be taught."

**Avoid touchtone-style prompts:**
```
"To hear your account balance, say 'balance.' To make a transfer, say 'transfer.'"
```

**Instead, use conversational questions:**
```
"I can help you check balances, make transfers, or pay bills. What would you like to do?"
```

#### 2. Contextual Suggestions

Rather than listing all features, offer relevant suggestions based on context:
- Time of day
- User's history
- Current task
- Location/environment

Example: Netflix's VUI learns from viewing habits and prioritizes relevant genres in voice search results during similar times.

#### 3. Sample Utterance Hints

Provide examples naturally in conversation:
```
"You can ask things like 'What's the weather tomorrow?' or 'Set a timer for 10 minutes.'"
```

#### 4. Help System Design

Create a robust help system that users can invoke:
- "Help" - General overview of capabilities
- "What can you do?" - Feature discovery
- Context-sensitive help during specific tasks

### The "What Can I Say?" Solution

When users ask "What can I say?" or "What can you do?":
1. Provide 2-3 example commands relevant to current context
2. Mention there are more options available
3. Offer to explain specific categories
4. Keep it brief - don't overwhelm

---

## 3. Progressive Disclosure of Features

### Core Concept

Progressive disclosure is a UX technique that reduces cognitive load by gradually revealing information as needed. In voice AI:
- Start with core functionality
- Reveal advanced features as users become comfortable
- Use success milestones to unlock new capabilities

### Implementation Strategies

#### Tiered Feature Introduction

**Level 1 - First Session:**
- Basic commands only
- Simple, reliable interactions
- Focus on building trust

**Level 2 - After N Successful Interactions:**
- Introduce additional features
- Mention shortcuts or advanced options
- "Did you know you can also..."

**Level 3 - Power Users:**
- Complex multi-step commands
- Customization options
- Proactive suggestions

#### Gamification Elements

From SoundHound's onboarding research:

1. **Simplicity and Choice**
   - Getting started should be effortless
   - Success with first interaction reduces friction from fear of failure

2. **Fast Delivery and Personalization**
   - Acknowledge need for immediate results
   - "Wow factor" builds reliance on the voice assistant

3. **Positive Feedback**
   - Acknowledge successful interactions
   - Recall past favorites
   - Offer to perform familiar tasks without being asked

4. **Achievement and FOMO (Fear of Missing Out)**
   - "Did you know you can also..."
   - Create community around voice experiences
   - Power user status that unlocks value

#### Contextual Feature Revelation

Reveal features when they become relevant:
```
User: "Set a reminder for tomorrow"
Assistant: "Done! By the way, you can also set recurring reminders 
by saying 'every day' or 'every Monday.'"
```

Only introduce new features after successful completion of current task.

---

## 4. Handling First-Use Failures Gracefully

### Why This Matters

From Google PAIR Guidelines:
> "How long the user has been using the product should impact how your AI communicates errors and helps users get back on track."

New users have different needs than experienced users:
- Less established expectations
- More likely to abandon after failure
- Need more guidance to recover

### Error Categories in Voice AI

#### 1. Context Errors
System works as intended, but user perceives an error because:
- Actions aren't well-explained
- Breaks user's mental model
- Based on poor assumptions

**Solution:** Adjust onboarding to establish better mental models.

#### 2. Failstates
System can't provide the right answer due to inherent limitations.

**Solution:** Messages should inform user specifically about system's limitations.

#### 3. User-Perceived Errors
First-time users may not consider it an error when initial recommendations aren't relevant. But expectations grow over time.

### Error Handling Best Practices

#### Graceful Reprompting

**Do - Escalating guidance:**
```
Turn 1:
User: "Banana"
Assistant: "Sorry, I didn't get that. What size would you like?"

Turn 2:
User: "Banana"  
Assistant: "Sorry, I didn't get that. We have Small, Medium and Large. 
What size would you like?"
```

**Don't:**
```
User: "Banana"
Assistant: "I didn't understand you, please say it again."
User: "Banana"
Assistant: "I didn't understand you, please say it again."
```

#### Acknowledge Unsupported Requests

**Do:**
```
User: "Book a table"
Assistant: "I'm sorry, MyPizza can't help with that yet. MyPizza skill 
can place orders for delivery or pick up. Which would you like to do?"
```

**Don't:**
```
User: "Book a table"
Assistant: "Sorry, I didn't understand that. What would you like to do?"
```

#### Avoid Blame Language

**Don't say:**
- "I didn't understand you"
- "I didn't hear that"

These encourage users to repeat more slowly/loudly rather than rephrasing.

**Do say:**
- "Sorry, I didn't get that"
- "Let me make sure I understand..."
- "Could you rephrase that?"

### Error Recovery Framework

From Google PAIR guidelines:

1. **Provide Paths Forward**
   - Always give users something they CAN do
   - "We don't have that, but we do have..."
   - Offer alternatives that match implied preferences

2. **Create Opportunities for Feedback**
   - Allow users to report what they expected
   - Learn from error patterns

3. **Return Control to User**
   - Let users take over when AI fails
   - Provide all information needed to continue manually

4. **Assume Subversive Use**
   - Make failure safe, boring, and natural
   - Don't make dangerous failures interesting
   - Avoid over-explaining vulnerabilities

### First-Use Specific Strategies

For first-time users specifically:

1. **Lower Stakes** - Start with low-risk, easily recoverable interactions
2. **More Patience** - Allow more attempts before escalating
3. **Clearer Guidance** - Provide more explicit options
4. **Positive Framing** - "Let's try this instead" vs "That didn't work"

---

## 5. Design Principles Summary

### Google's Six Principles for Voice UX

1. **Give your VUI a personality** - Users evaluate speech in terms of personality traits
2. **Move the conversation forward** - Provide informative responses that advance the interaction
3. **Be brief, be relevant** - Speech is transitory; keep messages short
4. **Leverage context** - Keep track of dialog and user circumstances
5. **Direct focus through word order** - Put known information before new information
6. **Don't teach commands** - Speech is intuitive

### Key Metrics to Track

- First-session completion rate
- Time to first successful interaction
- Error rate by session number
- Feature discovery rate over time
- Return rate after first session
- Help invocation frequency

---

## Sources

1. **SoundHound** - "A Guide to Voice Assistant Onboarding - Gamifying the Experience" (2021)
   https://www.soundhound.com/voice-ai-blog/a-guide-to-voice-assistant-onboarding-gamifying-the-experience/

2. **Google PAIR** - "Errors + Graceful Failure" - People + AI Guidebook
   https://pair.withgoogle.com/chapter/errors-failing/

3. **Amazon Developer** - "Best Practices for the Welcome Experience and Prompting in Alexa Skills" (2018)
   https://developer.amazon.com/en-US/blogs/alexa/post/cdbde294-8e41-4147-926f-56cdc2a69631/best-practices-for-the-welcome-experience-and-prompting-in-alexa-skill

4. **Google Design** - "Conversation Design: Speaking the Same Language" - VUI Principles
   https://design.google/library/speaking-the-same-language-vui

5. **Voicebot.ai** - "The Voice Assistant's Worst Skill - Discoverability" (2018)
   https://voicebot.ai/2018/06/16/the-voice-assistants-worst-skill-discoverability/

6. **ACM** - "What Can I Say? Effects of Discoverability in VUIs on Task Performance" (2020)
   https://dl.acm.org/doi/10.1145/3405755.3406119

7. **Designlab** - "Voice User Interface (VUI) Design Best Practices" (2024)
   https://designlab.com/blog/voice-user-interface-design-best-practices

8. **Toptal** - "Designing a VUI - Voice User Interface"
   https://www.toptal.com/designers/ui/designing-a-vui

---

## Confidence Level

**High confidence** in core principles - Multiple authoritative sources (Google, Amazon, academic research) consistently emphasize the same patterns around welcome experiences, progressive disclosure, and error handling.

**Medium confidence** in specific metrics/thresholds - Optimal numbers for "when to reveal features" or "how many errors before escalating" will require domain-specific testing.

## Research Gaps

- Limited research on voice onboarding specifically for AI coding assistants or developer tools
- Most research focuses on consumer voice assistants (Alexa, Google) rather than specialized professional applications
- Little quantitative data on optimal progressive disclosure timelines
- Need user research specific to Amplifier Voice's target use cases

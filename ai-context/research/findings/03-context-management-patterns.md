# Context Management Patterns for OpenAI Realtime API

> Research Date: 2026-01-31
> Focus: Context window, conversation history, session state, and memory management

## Executive Summary

The OpenAI Realtime API provides a stateful conversation model with server-managed context, offering significant advantages over HTTP-based chat completion APIs. However, effective context management requires understanding token limits, audio token overhead, and strategies for long conversations.

**Key Findings:**
- **Context Window:** 32k tokens (practical) to 128k tokens (theoretical maximum)
- **Audio Overhead:** ~10x more tokens for audio vs equivalent text
- **Auto-Truncation:** New `truncation` parameter available for automatic context management
- **Session Updates:** Instructions can be updated mid-session, though behavior may be delayed
- **Context Injection:** Items can be inserted at any position using `previous_item_id`

---

## 1. Context Window Size

### Documented Limits

| Model | Context Window | Notes |
|-------|---------------|-------|
| `gpt-realtime` | 32k tokens | Practical limit for voice conversations |
| `gpt-4o-realtime-preview` | 128k tokens | Theoretical maximum, but practical issues below ~10k |

### Important Considerations

**Performance Degradation:**
> "gpt-realtime supports a 32k token context window, though in certain use cases, you may notice performance degrade as you stuff more tokens into the context window."
> — OpenAI Cookbook

**Audio Token Overhead:**
- Audio uses approximately **10x more tokens** than equivalent text
- Amplitude, timing, and acoustic details must all be represented
- Roughly **800 tokens per minute** of speech (at 70% talk time)
- Text equivalent: ~150 spoken words/min ≈ 200 tokens/min

**Instruction Adherence Drift:**
As the token window grows, instruction adherence can drift. This is a critical consideration for maintaining consistent behavior in long conversations.

### Practical Limits

Community reports suggest that even with the advertised 128k context window:
- Function calling often fails with inputs exceeding ~10k tokens
- Model may respond with "I'm sorry, I couldn't process this" at high token counts
- Performance typically degrades well before theoretical limits

---

## 2. Conversation Items and History

### Session Architecture

The Realtime API maintains a stateful session with two key components:

| Component | Purpose |
|-----------|---------|
| **Session** | Controls global settings — model, voice, modalities, VAD, instructions |
| **Conversation** | Stores turn-by-turn messages between user and assistant (audio and text) |

### Key Client Events for Conversation Management

```javascript
// Create a new conversation item
{
  "type": "conversation.item.create",
  "previous_item_id": "item_123",  // Position in conversation, or "root" for first
  "item": {
    "id": "custom_id",
    "type": "message",
    "role": "user" | "assistant" | "system",
    "content": [{ "type": "input_text", "text": "..." }]
  }
}

// Delete a conversation item
{
  "type": "conversation.item.delete",
  "item_id": "item_123"
}

// Truncate an item (for handling interruptions)
{
  "type": "conversation.item.truncate",
  "item_id": "item_123",
  "content_index": 0,
  "audio_end_ms": 1500  // Truncate to this duration
}

// Retrieve a conversation item
{
  "type": "conversation.item.retrieve",
  "item_id": "item_123"
}
```

### Conversation Item Ordering

- Items form a linked list via `previous_item_id`
- Use `"previous_item_id": "root"` to insert at the beginning
- Use `"previous_item_id": null` or omit to append at the end
- Server events include `previous_item_id` to track conversation structure

### Accessing Conversation History

**Important:** The API does not provide a mechanism to retrieve the full conversation history. You must track history client-side by:

1. Listening to `conversation.item.created` events
2. Tracking the `previous_item_id` chain
3. Storing transcripts from `response.done` and transcription events

---

## 3. System Messages and Context Injection

### Injecting System Messages Mid-Conversation

You can inject system messages at any point in the conversation:

```javascript
{
  "type": "conversation.item.create",
  "previous_item_id": "root",  // Insert at beginning
  "item": {
    "id": "context_001",
    "type": "message",
    "role": "system",
    "content": [{ "type": "input_text", "text": "Summary of previous context..." }]
  }
}
```

**Best Practice - Use SYSTEM role for summaries:**
> "The summary is appended as a SYSTEM message rather than an ASSISTANT message. Testing revealed that, during extended conversations, using ASSISTANT messages for summaries can cause the model to mistakenly switch from audio responses to text responses."
> — OpenAI Cookbook

### RAG and Knowledge Base Integration

For RAG (Retrieval-Augmented Generation), the recommended pattern is:

1. Use `session.update` to modify `instructions` with retrieved context
2. Or inject context as a `system` message via `conversation.item.create`

```javascript
// Via session.update (updates global instructions)
{
  "type": "session.update",
  "session": {
    "instructions": "You are a helpful assistant. Use this context: [RAG results]"
  }
}

// Via conversation item (adds to conversation history)
{
  "type": "conversation.item.create",
  "item": {
    "type": "message",
    "role": "system",
    "content": [{ "type": "input_text", "text": "Relevant context: [RAG results]" }]
  }
}
```

---

## 4. Session State and Instruction Updates

### What Persists in Session State

The Session object controls:
- **Model:** Which realtime model to use
- **Voice:** Output voice selection (e.g., "shimmer", "alloy")
- **Modalities:** `["audio", "text"]` or subset
- **Instructions:** System prompt / behavior instructions
- **Turn Detection:** VAD settings and parameters
- **Input/Output Audio Format:** pcm16, g711_ulaw, g711_alaw
- **Input Audio Transcription:** Transcription model settings
- **Tools:** Function definitions for tool calling
- **Temperature:** Sampling temperature
- **Max Response Output Tokens:** Limit on output length

### Updating Instructions Mid-Session

```javascript
{
  "type": "session.update",
  "session": {
    "instructions": "New instructions here..."
  }
}
```

**Important Caveats:**

1. **Delayed Effect:** Changes may not immediately affect behavior
   > "The change may only work for new messages, not the current one"
   
2. **Context Influence:** The model considers conversation history, so:
   - New instructions compete with established conversation patterns
   - More explicit, forceful instructions may be needed
   
3. **Verification:** You'll receive `session.updated` confirming the change, but this doesn't guarantee immediate behavioral shift

### Session Limits

- **Maximum Session Duration:** 15 minutes
- **Maximum Context Length:** 128,000 tokens (with caveats above)

---

## 5. Memory Management for Long Conversations

### The Token Growth Problem

Every turn consumes tokens, and the window only grows:
- User audio input adds tokens
- Assistant audio output adds tokens  
- Token usage compounds with each exchange
- Cost increases exponentially with session length

### Summarization Strategy

**OpenAI's Recommended Pattern:**

1. Monitor token usage via `response.done` → `usage.total_tokens`
2. When approaching threshold, summarize older turns
3. Insert summary as a SYSTEM message at conversation start
4. Delete the original items that were summarized

```python
# Summarization trigger logic
SUMMARY_TRIGGER = 20_000  # tokens (adjust based on use case)
KEEP_LAST_TURNS = 2       # Keep recent turns verbatim

if state.latest_tokens >= SUMMARY_TRIGGER:
    old_turns = state.history[:-KEEP_LAST_TURNS]
    recent_turns = state.history[-KEEP_LAST_TURNS:]
    
    # Generate summary with cheaper model
    summary = await summarize_with_gpt4o_mini(old_turns)
    
    # Insert summary at conversation start
    await ws.send({
        "type": "conversation.item.create",
        "previous_item_id": "root",
        "item": {
            "type": "message",
            "role": "system",
            "content": [{"type": "input_text", "text": summary}]
        }
    })
    
    # Delete old items
    for turn in old_turns:
        await ws.send({
            "type": "conversation.item.delete",
            "item_id": turn.item_id
        })
```

### Persistent Conversations Across Sessions

Since sessions are limited to 15 minutes, for longer conversations:

1. Save conversation history as text transcripts
2. When starting a new session, inject history as initial context:
   ```javascript
   {
     "type": "conversation.item.create",
     "item": {
       "type": "message",
       "role": "system", 
       "content": [{
         "type": "input_text",
         "text": "Previous conversation summary: [text history]"
       }]
     }
   }
   ```

**Limitation:** You cannot reload "assistant" audio messages — only text can be reinjected.

---

## 6. Context Overflow and Auto-Truncation

### Automatic Truncation (New Feature)

The GA release introduced a `truncation` parameter for automatic context management:

```javascript
{
  "type": "session.update",
  "session": {
    "truncation": "auto"  // or use retention_ratio
  }
}
```

### How "Auto" Truncation Works

- Removes oldest conversation tokens that cannot fit
- **Preserves:** Initial system message / instructions (post-instruction content is trimmed)
- **Strategy:** In-the-middle truncation — keeps instructions and recent context, removes oldest turns
- **Goal:** Maximize cache hit rates while preserving relevant information

### Retention Ratio Alternative

```javascript
{
  "type": "session.update", 
  "session": {
    "truncation": {
      "type": "retention_ratio",
      "retention_ratio": 0.2  // Keep 20% of tokens
    }
  }
}
```

### Cache Considerations

**Why Aggressive Truncation Helps Caching:**
- OpenAI caches input tokens (80% discount on cached tokens)
- Removing a single message at a time breaks the cache on every turn
- Removing large chunks allows subsequent turns to rebuild cache benefits
- A very low `retention_ratio` maximizes cache efficiency

> "With caching being an 80x discount, anything higher than you discarding all but 1/80 is a huge bump back up in price for the discarding turn."

---

## 7. Handling Interruptions

### The Truncation Problem

When users interrupt the assistant:
- Audio generation is faster than speech playback
- User only hears partial response
- Server-side context contains the full response

### Required Pattern

```javascript
// When user interrupts, send truncation event
{
  "type": "conversation.item.truncate",
  "item_id": "assistant_response_id",
  "content_index": 0,
  "audio_end_ms": 1500  // Duration user actually heard
}
```

**Critical:** You must do this whether using automatic turn detection (`server_vad`) or manual mode. Otherwise, conversation history will include content the user never heard.

### Calculating Audio Duration

```python
# Track audio bytes sent to speaker
audio_bytes_played = len(played_audio)
bytes_per_sample = 2  # pcm16
sample_rate = 24000
audio_ms_played = (audio_bytes_played / bytes_per_sample / sample_rate) * 1000
```

---

## 8. Preambles and Prefilling

### Inserting Items Before Responses

You can position items at specific points in the conversation:

```javascript
// Insert at the very beginning (before all other items)
{
  "type": "conversation.item.create",
  "previous_item_id": "root",
  "item": { ... }
}

// Insert after a specific item
{
  "type": "conversation.item.create", 
  "previous_item_id": "item_xyz",
  "item": { ... }
}

// Append at the end (default)
{
  "type": "conversation.item.create",
  "item": { ... }
}
```

### Use Cases for Positioned Inserts

1. **Context Summaries:** Insert at "root" to provide background
2. **RAG Results:** Insert before triggering response
3. **User Context:** Inject user profile/preferences
4. **Conversation Steering:** Insert assistant "thoughts" to guide next response

---

## 9. Best Practices Summary

### For Short Conversations (< 5 minutes)
- Let context grow naturally
- Use `session.update` for any instruction changes
- Monitor token usage for cost awareness

### For Medium Conversations (5-15 minutes)
- Implement token monitoring
- Consider summarization at 20-25k tokens
- Use SYSTEM role for injected context
- Track and handle interruptions properly

### For Long Conversations (> 15 minutes)
- Plan for session restarts (15-minute limit)
- Implement persistent storage of transcripts
- Use aggressive summarization
- Consider `auto` truncation for simplicity
- Restart sessions with text-based history injection

### Cost Optimization
- Enable prompt caching (automatic)
- Use aggressive `retention_ratio` to maximize cache hits
- Summarize with cheaper models (gpt-4o-mini)
- Consider text-only modes where audio isn't needed

---

## 10. Known Issues and Limitations

### Current Limitations

1. **No History Retrieval:** Cannot fetch full conversation history from API
2. **No Audio History Reload:** Cannot inject previous assistant audio
3. **Session Duration:** Hard 15-minute limit
4. **Context Reliability:** Issues with large contexts (>10k tokens) for function calling
5. **Instruction Update Delay:** `session.update` may not immediately affect behavior

### Community-Reported Issues

- Turn detection can become unreliable with rapid interruptions
- Model may generate audio completions that don't appear in transcripts
- Performance degrades significantly before reaching theoretical limits
- Rate limits can be hit quickly with large system prompts

---

## Sources

1. [OpenAI Realtime Conversations Guide](https://platform.openai.com/docs/guides/realtime-conversations)
2. [OpenAI Realtime API Reference](https://platform.openai.com/docs/api-reference/realtime)
3. [Context Summarization Cookbook](https://developers.openai.com/cookbook/examples/context_summarization_with_realtime_api) - May 2025
4. [OpenAI Realtime API: The Missing Manual](https://www.latent.space/p/realtime-api) - Latent.Space, Nov 2024
5. [OpenAI Developer Community Discussions](https://community.openai.com/) - Various threads on context management
6. [Pipecat Framework Source](https://github.com/pipecat-ai/pipecat) - Reference implementation

---

## Confidence Level

**High Confidence:**
- Basic conversation item operations
- Session state components
- Audio token overhead (10x)
- Summarization patterns

**Medium Confidence:**
- Exact context window limits (32k vs 128k discrepancy)
- Auto-truncation behavior details
- Instruction update timing

**Needs Verification:**
- Specific threshold recommendations (use case dependent)
- Rate limit behaviors with large contexts
- Exact cache discount calculations

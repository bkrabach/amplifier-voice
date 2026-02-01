# OpenAI Realtime API: Pricing, Rate Limits & Cost Optimization

> Research compiled: January 2026
> Sources: OpenAI official documentation, pricing pages, developer forums

## Research Summary

The OpenAI Realtime API uses token-based pricing with separate rates for text, audio, and images. The **gpt-realtime-mini** model offers significant cost savings (roughly 3-5x cheaper) compared to the full model. **Prompt caching** provides automatic discounts of 50% for text and up to 80% for audio. Real-world costs vary significantly based on conversation length due to token accumulation - a key factor that can make costs balloon unexpectedly.

---

## 1. Pricing Structure

### Current Pricing (2025-2026)

#### gpt-realtime (Full Model)

| Token Type | Input | Cached Input | Output |
|------------|-------|--------------|--------|
| **Text** | $4.00 / 1M | $0.40 / 1M | $16.00 / 1M |
| **Audio** | $32.00 / 1M | $0.40 / 1M | $64.00 / 1M |
| **Image** | $5.00 / 1M | $0.50 / 1M | N/A |

#### gpt-realtime-mini

| Token Type | Input | Cached Input | Output |
|------------|-------|--------------|--------|
| **Text** | $0.60 / 1M | $0.06 / 1M | $2.40 / 1M |
| **Audio** | $10.00 / 1M | $0.30 / 1M | $20.00 / 1M |
| **Image** | $0.80 / 1M | $0.08 / 1M | N/A |

### Audio Token Conversion

- **Audio input**: 1 token per 100ms of audio
- **Audio output**: 1 token per 50ms of audio
- **Approximate cost per minute** (at launch rates):
  - Audio input: ~$0.06/minute
  - Audio output: ~$0.24/minute
  - **Combined**: ~$0.30/minute baseline

### Historical Context

| Date | Change |
|------|--------|
| Oct 1, 2024 | Launch: Audio $100/$200 per 1M tokens (input/output) |
| Oct 30, 2024 | Prompt caching added: 50% text, 80% audio discount |
| Feb 3, 2025 | Concurrent session limits removed |
| Aug 28, 2025 | General availability announced |

---

## 2. Comparison: Realtime vs Standard APIs

### Realtime API vs Chat Completions (Audio)

| Feature | Realtime API | Chat Completions (Audio) |
|---------|--------------|--------------------------|
| **Latency** | Low (streaming) | Higher (request/response) |
| **Use Case** | Real-time conversations | Non-real-time audio processing |
| **Audio Pricing** | Same rates | Same rates |
| **Connection** | WebSocket (persistent) | HTTP (per request) |
| **VAD** | Built-in | Not available |

### Realtime vs Traditional Pipeline (Whisper + LLM + TTS)

| Approach | Pros | Cons |
|----------|------|------|
| **Realtime API** | Single API, low latency, preserves emotion/prosody | Higher cost, token accumulation |
| **Whisper + LLM + TTS** | More control, potentially cheaper for long conversations | 250-1500ms added latency, loses audio nuance |

---

## 3. Rate Limits by Usage Tier

### Tier Qualification

| Tier | Qualification | Monthly Usage Limit |
|------|---------------|---------------------|
| Free | Allowed geography | $100 |
| Tier 1 | $5 paid | $100 |
| Tier 2 | $50 paid + 7 days | $500 |
| Tier 3 | $100 paid + 7 days | $1,000 |
| Tier 4 | $250 paid + 14 days | $5,000 |
| Tier 5 | $1,000 paid + 30 days | $200,000 |

### GPT-4o Realtime Rate Limits

| Tier | RPM (Requests/Min) | RPD (Requests/Day) | TPM (Tokens/Min) |
|------|--------------------|--------------------|------------------|
| Tier 1 | 200 | 10,000 | 40,000 |
| Tier 2 | 400 | - | 200,000 |
| Tier 3 | 5,000 | - | 800,000 |
| Tier 4 | 10,000 | - | 4,000,000 |
| Tier 5 | 20,000 | - | 15,000,000 |

### GPT-4o Mini Realtime Rate Limits

Same as full model:
| Tier | RPM | TPM |
|------|-----|-----|
| Tier 1 | 200 | 40,000 |
| Tier 2 | 400 | 200,000 |
| Tier 3 | 5,000 | 800,000 |
| Tier 4 | 10,000 | 4,000,000 |
| Tier 5 | 20,000 | 15,000,000 |

### Concurrent Sessions

As of February 2025, OpenAI **no longer limits concurrent sessions**. Previously:
- Tier 5: ~100 simultaneous sessions
- Tiers 1-4: Lower limits

---

## 4. Prompt Caching

### How It Works

Prompt caching is **automatic** - no code changes required. When input tokens match previous requests, cached rates apply.

### Discount Rates

| Input Type | Standard Price | Cached Price | Savings |
|------------|----------------|--------------|---------|
| Text | $4.00/1M | $0.40/1M | **90%** |
| Audio | $32.00/1M | $0.40/1M | **98.75%** |

### Maximizing Cache Hit Rate

1. **Keep session history static** - Don't modify or remove old content
2. **Don't change instructions mid-session** - Instructions are at the start, changes bust cache
3. **Avoid changing tool definitions** - Same reason as instructions
4. **Control truncation** - Use retention_ratio to prevent cache-busting

### Cache Behavior

```json
// Check cache usage in response.done event
{
  "usage": {
    "input_token_details": {
      "cached_tokens": 64,
      "cached_tokens_details": {
        "text_tokens": 64,
        "audio_tokens": 0
      }
    }
  }
}
```

---

## 5. Cost Optimization Strategies

### The Token Accumulation Problem

**Critical insight**: Tokens accumulate across turns. Each response includes ALL previous conversation history as input. This means:

- Turn 1: 120 input tokens
- Turn 2: 120 + new input + Turn 1 output = ~200+ tokens
- Turn N: Exponentially growing costs

**Real-world impact** (from developer testing):
- First minute: ~$0.30/min
- At 10 minutes: ~$1.20/min average
- Can reach $1.50+/min for long conversations

### Strategy 1: Use the Mini Model

The `gpt-realtime-mini` is **~3-5x cheaper** than the full model.

| Model | Audio Input | Audio Output |
|-------|-------------|--------------|
| gpt-realtime | $32/1M | $64/1M |
| gpt-realtime-mini | $10/1M | $20/1M |

**Tradeoff**: Lower intelligence for instruction following and function calling.

**Recommendation**: Develop with full model, then test with mini.

### Strategy 2: Configure Truncation

```json
{
  "event": "session.update",
  "session": {
    "truncation": {
      "type": "retention_ratio",
      "retention_ratio": 0.8,
      "token_limits": {
        "post_instructions": 8000
      }
    }
  }
}
```

- `post_instructions`: Max input tokens (excluding system prompt)
- `retention_ratio`: 0.8 means retain 80% after truncation (drop extra 20% for headroom)

### Strategy 3: Delete Old Conversation Items

Manually manage conversation history:

```json
{
  "type": "conversation.item.delete",
  "item_id": "item_CCXLecNJVIVR2HUy3ABLj"
}
```

### Strategy 4: Summarize and Replace (Advanced)

**Developer-proven approach** achieving ~$0.22/min at 10 minutes (vs $1.20/min baseline):

1. Collect transcriptions for user and assistant
2. Delete audio conversation items immediately after transcription
3. Send accumulated transcript to Assistants API for summarization
4. Update session instructions with summary:

```json
{
  "type": "session.update",
  "session": {
    "instructions": "Original system prompt...\n\nConversation summary:\n[summary here]"
  }
}
```

**Key tips**:
- Buffer 3+ transcriptions before processing
- Use Assistants API (maintains thread) not Chat Completions
- Summarize the summaries for long conversations
- Don't use `conversation.item.create` for summaries (breaks audio output)

### Strategy 5: Optimize System Prompts

System prompts are sent with **every turn**. A 1,000-word prompt can:
- Double per-minute costs (from ~$0.16 to ~$0.33 for mini)
- Impact grows with conversation length

**Tips**:
- Keep system prompts concise
- Move dynamic context to conversation items (can be deleted)
- Use tool definitions sparingly

### Strategy 6: VAD Configuration

Voice Activity Detection (VAD) settings affect costs:

```json
{
  "turn_detection": {
    "type": "server_vad",
    "threshold": 0.5,
    "prefix_padding_ms": 300,
    "silence_duration_ms": 500
  }
}
```

**Note**: Silence itself isn't tokenized, but:
- Background noise can trigger VAD
- Interruptions generate full response tokens even if cut off
- Consider manual turn detection for cost-sensitive applications

### Strategy 7: Limit Output Tokens

Default max_output_tokens is often 2K+. Reduce if possible:

```json
{
  "session": {
    "max_response_output_tokens": 1024
  }
}
```

---

## 6. Cost Estimation

### Per-Minute Estimates (Testing Results)

| Scenario | Model | Cost/Minute |
|----------|-------|-------------|
| Simple chat, no system prompt | mini | ~$0.16 |
| With 1K-word system prompt | mini | ~$0.33 |
| Simple chat, no system prompt | full | ~$0.18 |
| With 1K-word system prompt | full | ~$1.63 |
| 10-min conversation (unoptimized) | full | ~$1.20 avg |
| 10-min conversation (optimized) | full | ~$0.22 avg |

### Calculating Token Costs

```python
# Audio tokens
audio_input_tokens = audio_duration_ms / 100  # 1 token per 100ms
audio_output_tokens = audio_duration_ms / 50  # 1 token per 50ms

# Example: 1 minute of audio
input_tokens = 60000 / 100  # 600 tokens
output_tokens = 60000 / 50  # 1200 tokens

# Cost (gpt-realtime-mini)
input_cost = (600 / 1_000_000) * 10.00  # $0.006
output_cost = (1200 / 1_000_000) * 20.00  # $0.024
# Total: $0.03 per minute (first turn only!)
```

### Using the Playground for Estimation

1. Open Realtime Playground
2. Test with your actual prompts and tools
3. Check "Logs" tab for token breakdown
4. Token usage appears next to session ID

---

## 7. Billing & Monitoring

### Understanding Usage Reports

The `response.done` event contains detailed usage:

```json
{
  "usage": {
    "total_tokens": 253,
    "input_tokens": 132,
    "output_tokens": 121,
    "input_token_details": {
      "text_tokens": 119,
      "audio_tokens": 13,
      "image_tokens": 0,
      "cached_tokens": 64
    },
    "output_token_details": {
      "text_tokens": 30,
      "audio_tokens": 91
    }
  }
}
```

### Input Transcription Costs

Transcription uses a **separate model** (whisper-1 or gpt-4o-transcribe):
- Billed at that model's rates
- Check `conversation.item.input_audio_transcription.completed` for usage

### Rate Limit Headers

Monitor these HTTP headers:
- `x-ratelimit-limit-requests`
- `x-ratelimit-remaining-requests`
- `x-ratelimit-limit-tokens`
- `x-ratelimit-remaining-tokens`
- `x-ratelimit-reset-requests`
- `x-ratelimit-reset-tokens`

---

## 8. Key Takeaways

### For Development

1. **Start with full model** for best results, optimize later with mini
2. **Test in Playground** to understand real token usage
3. **Monitor response.done** events for cost tracking
4. **Implement truncation** from the start

### For Production

1. **Use gpt-realtime-mini** for cost-sensitive applications
2. **Implement conversation management** (delete/summarize strategy)
3. **Set truncation limits** with retention_ratio < 1.0
4. **Keep system prompts minimal**
5. **Consider manual VAD** for maximum control

### Cost Reality Check

| Conversation Length | Unoptimized | Optimized |
|---------------------|-------------|-----------|
| 1 minute | ~$0.30 | ~$0.15 |
| 5 minutes | ~$0.60/min | ~$0.20/min |
| 10 minutes | ~$1.20/min | ~$0.22/min |
| 15 minutes | ~$1.50+/min | ~$0.25/min |

**Bottom line**: Without optimization, the Realtime API can cost 5-10x the advertised rates for realistic conversations. With proper optimization (especially the summarize-and-replace strategy), costs can approach the advertised ~$0.30/min.

---

## Sources

1. [OpenAI Pricing Page](https://openai.com/api/pricing/)
2. [OpenAI Rate Limits Documentation](https://platform.openai.com/docs/guides/rate-limits)
3. [OpenAI Managing Costs Guide](https://platform.openai.com/docs/guides/realtime-costs)
4. [Introducing the Realtime API](https://openai.com/index/introducing-the-realtime-api/)
5. [OpenAI Developer Forum - Pricing Discussions](https://community.openai.com/t/realtime-api-pricing-vad-and-token-accumulation-a-killer/979545)
6. [New Realtime API Voices and Cache Pricing](https://community.openai.com/t/new-realtime-api-voices-and-cache-pricing/998238)
7. [ScriptByAI Rate Limits Guide](https://www.scriptbyai.com/rate-limits-openai-api/)
8. [eesel.ai GPT Realtime Mini Pricing Analysis](https://www.eesel.ai/blog/gpt-realtime-mini-pricing)

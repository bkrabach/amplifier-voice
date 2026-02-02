# OpenAI Prompt Caching Research

## Research Summary

OpenAI's prompt caching automatically caches repetitive prompt prefixes to reduce latency (up to 80%) and costs (50% for text, 80% for audio). It activates automatically for prompts exceeding 1024 tokens with no code changes required. For the Realtime API, cached audio tokens receive an 80% discount, making long voice conversations significantly more economical.

---

## How Prompt Caching Works

### Mechanism
1. **Automatic Activation**: Caching is enabled automatically for prompts ≥1024 tokens
2. **Prefix-Based Caching**: The system caches the longest prefix of a prompt that has been previously computed
3. **Cache Routing**: Requests are routed to servers based on a hash of the initial prefix (~256 tokens)
4. **Incremental Caching**: After the first 1024 tokens, additional tokens are cached in 128-token increments

### Process Flow
```
API Request → Cache Routing (hash of prefix) → Cache Lookup
    ↓
Cache Hit? → Yes → Use cached computation → Reduced cost/latency
    ↓
    No → Process full prompt → Cache prefix for future use
```

### What Gets Cached
| Content Type | Description |
|--------------|-------------|
| Messages | Complete messages array (system, developer, user, assistant) |
| Images | Both URL-linked and base64-encoded images in user messages |
| Tools | Tool definitions and the messages array |
| Structured Outputs | Schema is appended as prefix to system message |

---

## Cache Hit Requirements

### Minimum Requirements
1. **Token Threshold**: Prompt must be ≥1024 tokens
2. **Prefix Match**: The first 1024 tokens must be **identical** to a previous request
3. **Organization Scope**: Caching is scoped at the organization level (only same org members share cache)

### Cache Invalidation
- **Single character difference** in the first 1024 tokens = cache miss (`cached_tokens: 0`)
- Cache expires after **5-10 minutes** of inactivity
- During off-peak periods, cache may persist up to **1 hour**
- Azure OpenAI caches clear within 24 hours

### Monitoring Cache Hits
Cache hits are visible in the API response:
```json
{
  "usage": {
    "prompt_tokens": 2006,
    "completion_tokens": 300,
    "total_tokens": 2306,
    "prompt_tokens_details": {
      "cached_tokens": 1920,
      "audio_tokens": 0
    }
  }
}
```

---

## Cost Savings

### Text Token Pricing (50% Discount)

| Model | Uncached Input | Cached Input | Savings |
|-------|----------------|--------------|---------|
| GPT-4o | $2.50/MTok | $1.25/MTok | 50% |
| GPT-4o (fine-tuned) | $3.75/MTok | $1.875/MTok | 50% |
| GPT-4o mini | $0.15/MTok | $0.075/MTok | 50% |
| GPT-4o mini (fine-tuned) | $0.30/MTok | $0.15/MTok | 50% |
| o1-preview | $15.00/MTok | $7.50/MTok | 50% |
| o1-mini | $3.00/MTok | $1.50/MTok | 50% |
| GPT-4.1 | $2.00/MTok | $0.50/MTok | 75% |

### Latency Improvements
- **Up to 80% latency reduction** for longer prompts (>10,000 tokens)
- Typical improvements scale with prompt length

---

## Realtime API Caching

### Audio Token Pricing (80% Discount)
The Realtime API has specific caching benefits announced October 30, 2024:

| Token Type | Cache Discount |
|------------|----------------|
| Text Input | 50% less |
| Audio Input | **80% less** |

### Cost Impact
- A typical **15-minute conversation** costs approximately **30% less** with caching
- Audio tokens are particularly expensive, so the 80% cache discount is significant

### How It Works with Realtime
1. System instructions/prompts are cached between turns
2. Audio context from earlier in the conversation can be cached
3. The `cached_tokens` field in `response.done` events shows cache utilization

### Monitoring in Realtime API
```json
{
  "usage": {
    "input_tokens": 1566,
    "output_tokens": 300,
    "prompt_tokens_details": {
      "cached_tokens": 1408,
      "audio_tokens": 0
    }
  }
}
```

---

## Best Practices for Maximizing Cache Hits

### 1. Structure Prompts Correctly
```
[STATIC CONTENT - Beginning]
├── System instructions
├── Tool definitions  
├── Examples/few-shot prompts
├── Reference documents
└── Structured output schemas

[DYNAMIC CONTENT - End]
├── User-specific information
├── Current query
└── Recent conversation turns
```

### 2. Maintain Consistency
- **Tool Definitions**: Keep tool definitions and their **order** identical across requests
- **Images**: Maintain same order and same `detail` parameter setting
- **Templates**: Use standardized prompt templates for similar tasks

### 3. Optimize Token Usage
- Aim for prompts exceeding **1,024 tokens** to qualify for caching
- Use JSON or structured formats for consistent data presentation
- Batch similar requests to increase consecutive cache hits

### 4. Timing Considerations
- Cache expires after 5-10 minutes of inactivity
- Schedule batch processes with cache lifetime in mind
- Maintain consistent usage patterns to prevent cache eviction

### 5. Monitor and Iterate
- Track `cached_tokens` values in API responses
- Calculate cache hit rate: `cached_tokens / prompt_tokens`
- Analyze cache misses and adjust prompt structure
- Conduct periodic audits of common API calls

---

## Comparison: OpenAI vs Claude Prompt Caching

| Feature | OpenAI | Claude |
|---------|--------|--------|
| Activation | Automatic (≥1024 tokens) | Requires explicit API parameter |
| Cache Discount | 50% on cached reads | 90% on cache hits |
| Cache Write Cost | No additional cost | 25% premium on cache writes |
| Cache Duration | 5-10 min (up to 1 hour) | Up to 1 hour |
| Matching | Partial prefix matching | Exact match caching |
| Supported Models | GPT-4o, o1 series | Claude 3.5 Sonnet, 3 Opus, 3 Haiku |

### Key Difference
- **OpenAI**: Simpler, automatic, 50% flat discount
- **Claude**: More complex pricing, but up to 90% savings on cache hits (with write costs)

---

## Supported Models

### OpenAI Direct API
- GPT-4o (excluding `gpt-4o-2024-05-13` and `chatgpt-4o-latest`)
- GPT-4o mini
- GPT-4.1, GPT-4.1 mini, GPT-4.1 nano
- o1-preview
- o1-mini
- Fine-tuned versions of above models

### Azure OpenAI
- All GPT-4o or newer models
- Applies to: chat-completion, completion, responses, **real-time operations**
- Standard deployments: discounted pricing
- Provisioned deployments: up to **100% discount** on cached input tokens

---

## Implementation Notes

### No Code Changes Required
```python
# Caching happens automatically - no changes needed
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[
        {"role": "system", "content": long_system_prompt},  # Cached
        {"role": "user", "content": user_query}  # Dynamic
    ]
)

# Check cache utilization
cached = response.usage.prompt_tokens_details.cached_tokens
total = response.usage.prompt_tokens
print(f"Cache hit rate: {cached/total*100:.1f}%")
```

### Optional: prompt_cache_key Parameter
For improved cache hit rates with shared prefixes:
```python
# Combine with prefix hash for better routing
response = client.chat.completions.create(
    model="gpt-4o",
    messages=messages,
    prompt_cache_key="my-app-v1"  # Influences routing
)
```

**Note**: If requests for the same prefix + key exceed ~15 requests/minute, some may overflow to other machines, reducing cache effectiveness.

---

## Sources

1. [OpenAI Prompt Caching Guide](https://platform.openai.com/docs/guides/prompt-caching)
2. [OpenAI Cookbook - Prompt Caching 101](https://cookbook.openai.com/examples/prompt_caching101)
3. [OpenAI DevDay Announcement (Oct 2024)](https://openai.com/index/api-prompt-caching/)
4. [Azure OpenAI Prompt Caching Documentation](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/prompt-caching)
5. [OpenAI Community - New Realtime API voices and cache pricing](https://community.openai.com/t/new-realtime-api-voices-and-cache-pricing/998238)
6. [Portkey - OpenAI Prompt Caching Deep Dive](https://portkey.ai/blog/openais-prompt-caching-a-deep-dive/)

---

## Research Confidence

**High confidence** on core mechanics, pricing structure, and requirements - sourced from official OpenAI documentation and cookbook.

**Medium confidence** on Realtime API specifics - some details from community forums and announcements; official documentation may have additional details.

**Note**: Pricing and features may change. Always verify current pricing at [OpenAI Pricing](https://openai.com/api/pricing/).

---

*Research conducted: January 2026*

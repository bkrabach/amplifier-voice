# Voice AI Performance Benchmarks

> Research compiled: January 2026
> Sources: Industry reports, benchmark leaderboards, vendor documentation

## Executive Summary

Voice AI performance in 2025-2026 has reached production-ready thresholds across latency, accuracy, and cost dimensions. Key benchmarks indicate:
- **Latency**: Best-in-class systems achieve 250-500ms end-to-end response times
- **Accuracy**: Top ASR systems deliver 11-15% WER in real-world conditions
- **User Satisfaction**: AI voice agents achieve 80-90%+ CSAT when properly implemented
- **Cost**: Full-stack voice AI runs $0.05-0.15 per minute at scale

---

## 1. Latency Benchmarks

### Human Conversation Baseline
- **Human response time in conversation**: ~200-230ms
- **User frustration threshold**: >500ms delays disrupt cognitive flow
- **Disengagement threshold**: >10 seconds

### Real-Time Voice AI Leaderboard (Live Benchmarks)

| Provider | Current Latency | 24h Median | Status |
|----------|----------------|------------|--------|
| LiveKit | 863ms | 1,114ms | Good |
| OpenAI Realtime API | 1,127ms | 1,304ms | Good |
| Dasha | 1,170ms | 1,080ms | Good |
| Retell | 1,510ms | 1,476ms | Fair |
| VAPI | 2,077ms | 2,321ms | Poor |
| ElevenLabs | 2,206ms | 1,994ms | Poor |

*Source: voicebenchmark.ai (Dasha.ai independent benchmark)*

### Component-Level Latency Breakdown

Best-in-class orchestrated stack achieves **~510ms total latency**:

| Component | Best-in-Class | Typical Range |
|-----------|--------------|---------------|
| Speech-to-Text (STT) | 100ms | 100-200ms |
| Language Model (LLM) | 320ms | 200-500ms |
| Text-to-Speech (TTS) | 90ms | 150-300ms |
| Network Round-trip | - | 50-150ms |
| **Total Pipeline** | ~510ms | 500-1,150ms |

### TTS-Specific Latency (2025 Benchmarks)

| Provider | Asia (India) | US Server |
|----------|--------------|-----------|
| Azure Neural | 363ms | - |
| Deepgram Aura | - | 436ms |
| ElevenLabs Flash v2.5 | ~75ms | ~75ms |
| Cartesia | ~90ms | ~90ms |

### Latency Targets by Application

| Application | Target Latency | Notes |
|-------------|---------------|-------|
| Real-time conversation | <500ms | Maintains natural flow |
| Voice assistants | <500ms end-to-end | Industry standard |
| Chat applications | <100ms TTFT | 40+ tokens/second sustained |
| High-frequency trading | Sub-microsecond | Specialized hardware |

### Edge Computing Impact
- Edge deployment reduces latency by **60-80%**
- Achieves sub-50ms response times vs 200-800ms for cloud processing
- Eliminates per-API-call costs

---

## 2. Accuracy Standards (Word Error Rate)

### WER Benchmarks by Provider

| Provider/Model | WER (AA-WER Index) | Price/1000 min | Notes |
|----------------|-------------------|----------------|-------|
| Google Chirp 2 | 11.6% | $16.00 | Best overall accuracy |
| NVIDIA Parakeet TDT | 13.0% | $1.32 | Open weights leader |
| Canary Qwen 2.5B | 13.2% | $0.74 | Budget option |
| ElevenLabs Scribe v2 | 14.0% | $6.67 | - |
| Amazon Transcribe | 14.0% | $24.00 | Enterprise standard |
| Speechmatics Enhanced | 14.4% | $6.70 | - |
| AssemblyAI Universal | 14.5% | $2.50 | Best value |
| Mistral Voxtral Small | 14.7% | $4.00 | - |
| Google Gemini 2.5 Pro | 15.0% | $0.00* | Multi-modal |
| Slam-1 (AssemblyAI) | 15.1% | $4.50 | - |
| Whisper Large v2 | 15.8% | $6.00 | Baseline reference |
| Deepgram Nova-2 | 17.3% | $4.30 | Real-time optimized |
| Deepgram Nova-3 | 18.3% | $4.30 | Latest version |

*Source: Artificial Analysis benchmark (AA-WER across VoxPopuli, Earnings-22, AMI-SDM datasets)*

### Industry WER Targets

| Use Case | Target WER | Notes |
|----------|-----------|-------|
| Production deployment | <5% | Controlled environments |
| Enterprise standard | 5-15% | Real-world conditions |
| Acceptable minimum | <20% | Basic functionality |
| Medical transcription | <3% | Specialized models achieve 99%+ accuracy |

### Accuracy by Environment

| Condition | Impact on WER |
|-----------|--------------|
| Clean audio, native speakers | Baseline |
| Background noise | +5-15% WER |
| Accented speech (pre-2024) | +10-30% WER |
| Accented speech (2025+) | +5-10% WER (18-60% improvement via accessibility projects) |
| Domain-specific terminology | Varies by model training |

### Key Accuracy Findings

1. **Human parity achieved**: Top systems now match or exceed human transcription accuracy in clean conditions
2. **Noise handling**: Krisp Background Voice Cancellation achieves 25%+ improvement in voice activity detection
3. **Multilingual**: Top platforms support 100+ languages with <5% WER in tier-1 languages
4. **Medical**: Specialized models (DeepScribe, Deepgram Nova-2 Medical) achieve up to 99% accuracy

---

## 3. User Satisfaction Benchmarks

### CSAT (Customer Satisfaction Score) Targets

| Performance Level | CSAT Range | Characteristics |
|------------------|------------|-----------------|
| Excellent | 90%+ | Near-human experience, minimal escalation |
| Good | 80-89% | Effective automation, smooth handoffs |
| Acceptable | 70-79% | Functional but room for improvement |
| Poor | <70% | User frustration, high abandonment |

### Industry Benchmarks

| Metric | Benchmark | Source |
|--------|-----------|--------|
| CSAT improvement with voice AI | +35% | Enterprise deployments |
| Resolution time reduction | -25% | Call center implementations |
| Agent productivity improvement | +22% | AI-augmented workflows |
| First Call Resolution target | 70-80% | Industry standard |

### Containment Rate Benchmarks

| Complexity Level | Target Containment | Notes |
|-----------------|-------------------|-------|
| Simple inquiries (FAQ, status) | 85-95% | Fully automated |
| Moderate complexity | 70-85% | Hybrid approach |
| Complex issues | 50-70% | Requires human backup |
| Enterprise overall target | 70-90% | Use-case dependent |

**Note**: 100% containment is NOT the goal - high-value/sensitive conversations should escalate to humans.

### User Experience Thresholds

| Response Time | User Perception |
|--------------|-----------------|
| <100ms | Instantaneous (optimal) |
| 100-500ms | Natural conversation |
| 500ms-1s | Noticeable delay |
| 1-10s | Frustrating |
| >10s | Abandonment likely |

### Key Satisfaction Drivers

1. **Elimination of hold times**: Primary driver of improved CSAT
2. **24/7 availability**: Consistent service quality
3. **Consistent responses**: No agent variability
4. **Seamless handoffs**: Smooth transition to human when needed

### Common Failure Modes Impacting Satisfaction

- **72%** cite solution quality (voice clarity, conversational flow) as adoption barrier
- **70%** report frustration with inability to handle complex issues
- Context/memory loss across conversations
- Inadequate CRM/scheduling integration

---

## 4. Cost Benchmarks

### Full-Stack Voice AI Pricing

| Provider Tier | Cost per Minute | Notes |
|--------------|-----------------|-------|
| Economy stack | $0.04-0.07 | Basic components |
| Standard managed | $0.05-0.10 | Typical platform pricing |
| Enterprise (negotiated) | $0.03-0.07 | 30-50% volume discounts |
| In-house at scale | $0.02-0.05 | >1M minutes/month |

### Component-Level Pricing

#### Speech-to-Text (per 1,000 minutes)

| Provider | Price | WER |
|----------|-------|-----|
| Deepinfra Whisper | $0.45 | 16.8% |
| Groq Whisper Turbo | $0.67 | 17.8% |
| Fireworks Whisper | $1.00 | 17.8% |
| AssemblyAI Universal | $2.50 | 14.5% |
| Deepgram Nova-2/3 | $4.30 | 17-18% |
| OpenAI Whisper | $6.00 | 15.8% |
| Google Chirp | $16.00 | 11.6% |
| Amazon Transcribe | $24.00 | 14.0% |

#### Text-to-Speech

| Provider | Pricing Model | Notes |
|----------|--------------|-------|
| ElevenLabs | $5-15/million chars | Volume discounts available |
| OpenAI TTS | ~$15/million chars | Integrated with GPT |
| Google Cloud TTS | $4-16/million chars | Tiered by voice type |
| Amazon Polly | $4/million chars | Standard voices |

#### LLM Inference (for voice agents)

| Model | Input Cost | Output Cost |
|-------|-----------|-------------|
| GPT-4o Realtime | 60% reduction (Dec 2024) | 87.5% reduction |
| GPT-4o | $2.50/M tokens | $10/M tokens |
| Claude 3.5 Sonnet | $3/M tokens | $15/M tokens |
| Open source (self-hosted) | Infrastructure only | Variable |

### Cost Example: 22,000 Calls/Month (66,000 minutes)

| Configuration | Monthly Cost |
|--------------|--------------|
| Economy components | ~$2,905 |
| Enterprise pricing | ~$1,500 |
| Human agents (comparison) | $15,000-30,000+ |

### ROI Benchmarks

| Metric | Typical Result |
|--------|---------------|
| Cost reduction vs human agents | 70-80% |
| Payback period | 12 months |
| Expected ROI | 2-3x investment |
| Support team workload reduction | 70-80% |
| Response time improvement | 85% faster |

### Cost Optimization Strategies

1. **Edge computing**: Eliminates per-API-call costs, reduces latency 60-80%
2. **Hybrid deployment**: Balance latency control with scaling flexibility
3. **Volume negotiation**: Enterprise deals achieve 30-50% discounts
4. **Self-hosting threshold**: Cost-effective at ~1M minutes/month

---

## Market Context

### Adoption Statistics (2025-2026)

- **80%** of businesses projected to adopt voice AI by 2026
- **76%** report quantifiable benefits from deployment
- **58%** say profits exceeded expectations within 12 months
- **32.9%** of implementations in banking/financial services
- **8.4 billion** voice assistants in active use globally

### Market Size

- **2024**: $4.9 billion
- **2033 (projected)**: $54.54 billion
- **CAGR**: 30.7%

---

## Benchmark Sources

1. **Latency**: voicebenchmark.ai (Dasha.ai), Deepgram benchmarks, vendor documentation
2. **Accuracy (WER)**: Artificial Analysis (artificialanalysis.ai), Hugging Face Open ASR Leaderboard
3. **User Satisfaction**: Industry reports, enterprise case studies, Poly.ai metrics
4. **Cost**: Vendor pricing pages, Artificial Analysis, AgentDock research

---

## Key Takeaways for Implementation

### Minimum Viable Benchmarks

| Metric | Target | Rationale |
|--------|--------|-----------|
| End-to-end latency | <800ms | Maintain conversation flow |
| WER | <15% | Production-quality accuracy |
| CSAT | >80% | User acceptance threshold |
| Containment rate | >70% | ROI positive |
| Cost per minute | <$0.10 | Competitive with alternatives |

### Best-in-Class Targets

| Metric | Target | Achievable With |
|--------|--------|-----------------|
| End-to-end latency | <500ms | Edge + optimized stack |
| WER | <10% | Google Chirp + domain tuning |
| CSAT | >90% | Excellent UX + seamless handoffs |
| Containment rate | >85% | Well-scoped use cases |
| Cost per minute | <$0.05 | Scale + self-hosting |

# Voice Cloning and Custom Voices for AI Assistants

## Research Summary

Voice cloning technology has matured significantly, with ElevenLabs leading in quality and OpenAI expanding custom voice capabilities for enterprise customers. Key considerations include consent verification requirements, the trade-off between instant and professional cloning approaches, and legal frameworks that are still evolving to address deepfake concerns.

---

## 1. ElevenLabs Voice Cloning

### Overview

ElevenLabs offers two main voice cloning approaches:

#### Instant Voice Cloning (IVC)
- **Speed**: Near-instantaneous clone creation
- **Input Required**: Short audio samples (as little as 30 seconds)
- **How it Works**: Uses prior knowledge from training data to make an educated guess rather than training a custom model
- **Best For**: Common voice types, accents the AI has encountered during training
- **Limitations**: May struggle with very unique voices or unusual accents
- **Availability**: Starter plan and above

#### Professional Voice Cloning (PVC)
- **Speed**: ~3 hours for English, ~6 hours for multilingual
- **Input Required**: Large set of voice data (recommended: 30+ minutes to 1+ hour)
- **How it Works**: Trains a dedicated model on your voice data
- **Quality**: "Indistinguishable from the original voice"
- **Best For**: Brand voices, professional applications requiring maximum fidelity
- **Availability**: Creator plan and above ($22/month+)

### PVC Requirements & Process

1. **Audio Quality Standards**:
   - Recording environment: Minimal room echo/reverb ("deadened" room)
   - Microphone: Professional XLR ($150-300 range recommended)
   - Pop filter: Required to avoid plosives
   - Format: WAV files at 44.1kHz or 48kHz, 24-bit minimum
   - Levels: Peaks at -6dB to -3dB, average loudness -18dB

2. **Verification Process** (Required for PVC):
   - CAPTCHA challenge: Read specific text aloud
   - Recording submission: Voice owner must record the CAPTCHA text
   - Manual verification available for accessibility needs
   - **Critical**: Can only clone your OWN voice, not someone else's (even with consent)

3. **Performance Consistency**:
   - Must maintain consistent cadence, tonality, and style throughout recordings
   - Cannot mix animated and subdued performances
   - Must maintain consistent accent
   - AI will replicate pauses, stutters, breaths, "uhms" and "ahs"

### ElevenLabs Pricing Tiers

| Plan | Credits/Month | Voice Cloning | Price |
|------|---------------|---------------|-------|
| Starter | 30,000 | Instant only | ~$5/mo |
| Creator | 100,000 | Professional | ~$22/mo |
| Pro | 500,000 | Professional | ~$99/mo |
| Scale | 2,000,000 | Professional | ~$330/mo |

**Sources**: 
- https://elevenlabs.io/docs/creative-platform/voices/voice-cloning
- https://elevenlabs.io/docs/developers/guides/cookbooks/voices/professional-voice-cloning

---

## 2. OpenAI Voices

### Built-in Voices (Available to All)

OpenAI provides 13 built-in voices for TTS and Realtime API:

| Voice | Description |
|-------|-------------|
| **Alloy** | Neutral and balanced |
| **Ash** | Standard voice |
| **Ballad** | Standard voice |
| **Coral** | Standard voice |
| **Echo** | Warm and engaging |
| **Fable** | Standard voice |
| **Nova** | Standard voice |
| **Onyx** | Standard voice |
| **Sage** | Standard voice |
| **Shimmer** | Energetic and expressive |
| **Verse** | Standard voice |
| **Marin** | Standard voice (newer) |
| **Cedar** | Standard voice (newer) |

### Custom Voices (Limited Availability)

OpenAI's custom voice technology is available but **restricted to eligible enterprise customers**:

- **Voice Engine**: Originally planned for March 2024 release, still in limited testing (as of early 2025)
- **Access**: Contact OpenAI sales team; requires eligibility review
- **Requirements**: Audio sample + consent recording
- **Safety measures**: Delayed wider release due to election security and deepfake concerns

#### Custom Voice Capabilities (December 2025 Updates)
- More natural tones
- Increased faithfulness to original sample
- Improved accuracy across dialects
- Better voice consistency in long conversations

### Latest Model Snapshots (December 2025)

| Model | Use Case |
|-------|----------|
| `gpt-4o-mini-transcribe-2025-12-15` | Speech-to-text |
| `gpt-4o-mini-tts-2025-12-15` | Text-to-speech |
| `gpt-realtime-mini-2025-12-15` | Real-time speech-to-speech |
| `gpt-audio-mini-2025-12-15` | Chat completions with audio |

**Key Improvements**:
- 35% lower word error rate on Common Voice and FLEURS benchmarks
- ~90% fewer hallucinations compared to Whisper v2
- Better tool calling accuracy (+12.9 percentage points)
- Better instruction following (+18.6 percentage points)

**Sources**:
- https://developers.openai.com/blog/updates-audio-models
- https://platform.openai.com/docs/api-reference/audio

---

## 3. Voice Consistency Across Sessions

### Challenges

1. **Generation Variability**: Each TTS generation can sound slightly different
2. **Emotional Drift**: Voice may vary in emotion/energy across generations
3. **Context Loss**: New sessions start fresh without voice memory

### Solutions

#### ElevenLabs Stability Control
- **Stability Parameter**: Controls randomness between generations
- Higher values = more consistent, professional, formal
- Lower values = more emotional variation
- Recommended: High stability for brand consistency

#### OpenAI Improvements (Dec 2025)
- Upgraded decoder for more natural, stable voice output
- Better voice consistency when using Custom Voices
- Improved performance on long conversations

#### Best Practices
1. Use consistent prompting/instructions for TTS
2. Maintain same model version across sessions
3. For brand voices: Use Professional Voice Cloning over Instant
4. Store and reuse voice IDs consistently
5. Test voice samples across different text types

---

## 4. Creating Brand Voices

### Strategy Options

| Approach | Pros | Cons |
|----------|------|------|
| **ElevenLabs PVC** | Highest quality, unique voice | Requires voice talent, Creator+ plan |
| **ElevenLabs Voice Library** | Ready-made professional voices | Not unique to your brand |
| **ElevenLabs Voice Design** | Create voices via text prompts | Less precise control |
| **OpenAI Custom Voices** | Native integration | Limited availability |
| **OpenAI Built-in Voices** | Easy, no setup | Shared with other users |

### Brand Voice Best Practices

1. **Define Voice Attributes**:
   - Tone: Warm, professional, energetic, calm
   - Pace: Fast, measured, deliberate
   - Personality: Friendly, authoritative, helpful

2. **Recording Guidelines (for PVC)**:
   - Professional recording environment
   - Consistent performance throughout
   - Match the exact tone/style you want replicated
   - Minimum 30 minutes of clean audio (1+ hour recommended)

3. **Voice Governance**:
   - Label AI-generated outputs clearly
   - Maintain documentation of consent/permissions
   - Regular quality audits across use cases

### Resemble.ai Alternative

For brand voices, Resemble.ai offers:
- High-quality recordings requirement for human-sounding voices
- Custom voice creation for brands
- Voice cloning with consent verification
- Enterprise solutions

---

## 5. Legal Considerations

### Consent Requirements

#### ElevenLabs Policies
- **Professional Voice Cloning**: Can ONLY clone your own voice
- Verification process confirms voice ownership
- Instant Voice Cloning requires checkbox affirming permission
- Cannot clone someone else's voice even with their consent (for PVC)

#### OpenAI Policies
- Custom Voices require uploaded consent recording
- Agreement not to represent a person without permission
- Must clearly state voices are AI-generated
- Eligible customers only (enterprise review)

### Legal Frameworks

#### United States
- **Right of Publicity**: Varies by state; protects against unauthorized commercial use of voice
- **State Laws Evolving**: Some states adding specific voice cloning provisions
- **FTC Regulations**: AI-generated content disclosure requirements
- **2024-2025 Developments**: Increased legal activity around deepfakes and election security

#### Key Legal Principles
1. **Explicit Consent**: Primary safeguard for legal voice cloning
2. **Documentation**: Written consent, verification recordings
3. **Disclosure**: Clear labeling of AI-generated voice content
4. **Commercial Use**: Additional considerations for monetized content

#### Risks Without Consent
- Privacy violations
- Defamation claims
- Publicity rights infringement
- Fraud/identity theft liability
- Copyright issues (for distinctive vocal performances)

### Best Practices for Compliance

1. **Always obtain explicit written consent**
2. **Keep consent documentation on file**
3. **Use verification features (ElevenLabs CAPTCHA)**
4. **Label AI-generated content clearly**
5. **Consult legal counsel for commercial applications**
6. **Stay updated on evolving regulations (EU AI Act, state laws)**

**Sources**:
- https://sites.law.duq.edu/juris/2025/11/25/the-law-speaks-up-ai-voice-cloning-and-consent/
- https://www.skadden.com/insights/publications/2025/07/new-york-court-tackles-the-legality-of-ai-voice-cloning
- https://legalclarity.org/is-voice-cloning-legal-a-look-at-the-laws/

---

## 6. Quality Factors for Natural-Sounding Voices

### Key Quality Metrics

| Metric | Description |
|--------|-------------|
| **WER** | Word Error Rate - transcription accuracy |
| **MOS** | Mean Opinion Score - subjective quality rating (1-5) |
| **PESQ** | Perceptual Evaluation of Speech Quality |
| **Latency** | Time to first audio byte |

### Factors Affecting Naturalness

#### 1. Prosody
- **Intonation**: Pitch variation patterns
- **Rhythm**: Timing and pacing of speech
- **Stress**: Emphasis on words and syllables
- **Consistency**: Stable prosodic patterns throughout

#### 2. Emotional Expression
- Range of emotions (neutral, happy, concerned, etc.)
- Appropriate emotion for context
- Smooth transitions between emotional states

#### 3. Technical Quality
- **Sample Rate**: Higher = better quality (48kHz preferred)
- **Bit Depth**: 24-bit minimum for professional quality
- **Noise Floor**: Minimal background noise in training data
- **Room Acoustics**: Dry recording environment

#### 4. Training Data Quality
- Diverse speaking styles
- Multiple accents and languages
- Varied emotional expressions
- Clean, professional recordings

### Latency Considerations

- **Real-time turn-taking**: <500ms required for natural conversation
- **First byte latency**: Critical for perceived responsiveness
- **Streaming TTS**: Essential for real-time applications

### Provider Quality Comparison

| Provider | Strength | Notes |
|----------|----------|-------|
| **ElevenLabs** | Highest voice quality | Industry-leading naturalness |
| **OpenAI TTS** | Good integration, improving quality | Dec 2025 models significantly better |
| **Cartesia** | Low latency | Good for real-time applications |

### Quality Optimization Tips

1. **Use highest quality input samples** for voice cloning
2. **Test across different text types** (questions, statements, lists)
3. **Evaluate with diverse listeners** (accents, backgrounds)
4. **Monitor hallucinations** especially during silence
5. **Balance quality vs latency** for your use case

---

## Recommendations for Implementation

### For Brand/Custom Voice

1. **Recommended**: ElevenLabs Professional Voice Cloning
   - Hire voice talent or use internal spokesperson
   - Record 1+ hour of high-quality audio
   - Complete verification process
   - Test extensively before deployment

2. **Alternative**: OpenAI Custom Voices (if eligible)
   - Contact OpenAI sales for eligibility
   - Simpler setup, native integration
   - May have availability constraints

### For Quick Prototyping

1. **ElevenLabs Instant Voice Cloning**: Fast results, good quality
2. **OpenAI Built-in Voices**: No setup, immediate availability
3. **Voice Library Voices**: Pre-made professional options

### For Voice Consistency

1. Lock model versions (use specific snapshots)
2. Use Professional Voice Cloning over Instant
3. Maintain high stability settings
4. Test across session boundaries
5. Document voice parameters for reproducibility

---

## References

1. ElevenLabs Voice Cloning Documentation: https://elevenlabs.io/docs/creative-platform/voices/voice-cloning
2. ElevenLabs PVC API Guide: https://elevenlabs.io/docs/developers/guides/cookbooks/voices/professional-voice-cloning
3. OpenAI Audio Models Update (Dec 2025): https://developers.openai.com/blog/updates-audio-models
4. OpenAI API Reference - Audio: https://platform.openai.com/docs/api-reference/audio
5. Voice Cloning Legal Considerations: https://legalclarity.org/is-voice-cloning-legal-a-look-at-the-laws/
6. AI Voice Cloning Regulation: https://www.resemble.ai/ai-voice-cloning-regulation-legal-updates-concerns/
7. Kukarella Voice Cloning Ethics Guide: https://www.kukarella.com/resources/ai-voice-cloning/the-guide-to-voice-cloning-ethics-and-legal-rights

---

*Research compiled: January 2026*
*Note: Voice AI technology is rapidly evolving. Verify current capabilities and pricing with providers.*

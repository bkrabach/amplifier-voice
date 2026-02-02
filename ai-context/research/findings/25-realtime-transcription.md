# Real-Time Transcription & Closed Captions for Voice AI

## Research Summary

Real-time transcription converts spoken words into text within milliseconds using streaming speech recognition that processes audio in small chunks (20-100ms). Key capabilities include speaker diarization for multi-speaker identification, automatic punctuation/formatting through AI models and Inverse Text Normalization (ITN), word-level confidence scores for uncertainty indication, and interim/final result mechanisms for progressive error correction.

---

## 1. Live Transcription Fundamentals

### How Streaming Speech Recognition Works

Real-time speech-to-text processes audio continuously in three connected steps:

**Audio Capture & Streaming:**
- Microphone captures sound waves → converts to digital data
- Audio encoded into small chunks (typically 20-100 milliseconds each)
- Chunks stream directly to speech recognition service via WebSocket/WebRTC
- Connection stays open throughout conversation (bidirectional pipeline)

**Real-Time Processing & Partial Results:**
- AI model starts working immediately on each audio chunk
- Does NOT wait for complete sentences before making predictions
- Partial results appear almost instantly ("The weather" → "The weather today")
- Early guesses refined as more audio arrives and context builds

**Balance Speed vs Accuracy Through:**
- Sound patterns (phoneme detection)
- Language modeling (word sequence probability)
- Context awareness (earlier conversation)
- Confidence scoring (certainty per word)

### Latency Benchmarks

| Result Type | Target Latency | Use Case |
|-------------|----------------|----------|
| Partial results | 200-300ms | Live captions, typing feedback |
| Refined results | 500ms-1s | Continuous updates |
| Final results | 1-3 seconds | Complete accuracy with formatting |

**Network Impact:** Strong internet keeps delays minimal; poor connectivity can add several seconds of lag. Some systems buffer audio locally for network hiccups.

---

## 2. Speaker Diarization

### What It Is

Speaker diarization partitions an audio stream into homogeneous segments by speaker identity—answering "who spoke when" in an audio recording.

### How It Works

1. **Voice Activity Detection (VAD):** Identifies speech segments vs. silence/noise
2. **Speaker Embeddings:** Creates unique digital "fingerprint" vectors for each voice
3. **Clustering:** Groups speech segments belonging to same speaker
4. **Labeling:** Assigns speaker identity (Guest1, Guest2, Speaker A, etc.)

### Real-Time vs Batch Diarization

| Aspect | Real-Time | Batch |
|--------|-----------|-------|
| Latency | Milliseconds | Minutes |
| Accuracy | Lower (limited context) | Higher (full audio) |
| Use Case | Live meetings, captions | Post-processing, archives |
| Speaker Modeling | Must decide quickly | Can revise assignments |

**Microsoft Azure GA Announcement (May 2024):**
- Real-time diarization distinguishes speakers via single-channel audio in streaming mode
- Removed 7-second initial speaker learning limitation
- ~3% improvement in Word Diarization Error Rate (WDER)

### Implementation Approaches

**Single-Channel (Harder):**
- System must separate voices from mixed audio
- Relies on voice characteristics (pitch, tone, speaking rate)
- More prone to errors with overlapping speech

**Multi-Channel (Easier):**
- Separate audio stream per speaker
- Create separate session for each speaker
- Combine into single transcript with reliable attribution

### Key Challenges

- **Overlapping speech:** Multiple speakers talking simultaneously
- **Speaker variability:** Same person sounds different (emotions, volume)
- **Background noise:** Masks or distorts speaker voice
- **Short utterances:** Insufficient audio for reliable speaker embedding

### Metrics

- **Diarization Error Rate (DER):** Percentage of time speech is mislabeled
- **Word-level DER (WDER):** Per-word speaker attribution accuracy
- **Jaccard Error Rate (JER):** Overlap-based speaker accuracy

---

## 3. Punctuation & Formatting

### Why It Matters

Raw transcript without formatting:
```
if you picture a sound meter with a needle that bounces up and down every time theres a sound the tone is supposed to put the needle perfectly at this one spot
```

With automatic punctuation and casing:
```
If you picture a sound meter with a needle that bounces up and down every time there's a sound, the tone is supposed to put the needle perfectly at this one spot.
```

### Core Components

**1. Automatic Punctuation:**
- AI inserts commas, periods, question marks, exclamation marks
- Based on patterns learned from massive formatted text datasets
- Analyzes word sequences to predict grammatical structure

**2. Proper Noun Casing:**
- Capitalizes names, places, organizations
- Handles acronyms (NASA, NY Times)
- Sentence-initial capitalization

**3. Inverse Text Normalization (ITN):**

Converts spoken form to written form using rule-based FST (Finite State Transducer):

| Spoken Form | Written Form |
|-------------|--------------|
| "february fourth twenty twenty two" | "February 4th, 2022" |
| "one two three main street" | "123 Main Street" |
| "five hundred dollars" | "$500" |
| "john at example dot com" | "john@example.com" |
| "nine one one" | "911" |

**Critical for downstream tasks:** Dates, numbers, emails, phone numbers must be accurately formatted or workflows fail.

### Accuracy Considerations

**Challenges:**
- Audio quality (background noise, poor recordings)
- Speaker dynamics (cross-talk, overlapping)
- Domain complexity (industry jargon, technical terms)
- Streaming vs batch (less future context in real-time)

**Best Practices:**
- Test with representative audio from production environment
- Some NLP tasks may need raw unformatted text
- Build resilient workflows that handle formatting inconsistencies

---

## 4. Confidence Scores

### What They Are

Word confidence scores quantify the likelihood that a transcribed word is accurate—typically a decimal between 0 and 1.

| Score Range | Interpretation |
|-------------|----------------|
| 0.95-1.0 | High confidence, likely correct |
| 0.80-0.95 | Moderate confidence |
| 0.60-0.80 | Low confidence, may need review |
| < 0.60 | Very uncertain, likely error |

### How They're Generated

1. **Acoustic Modeling:** Probability of audio matching phonetic patterns
2. **Language Modeling:** Probability of word given context
3. **Combined Scoring:** Aggregate at word, utterance, or document level

### Multi-Level Confidence

```
Phonetic Level → Word Level → Utterance Level → Document Level
```

- **Word-level:** Most granular, useful for highlighting uncertain words
- **Utterance-level:** Average of word scores, overall sentence reliability
- **Document-level:** Aggregate transcript quality metric

### Practical Applications

**1. Error Detection UI:**
- Visually indicate uncertain words (opacity, color, underline)
- Allow users to focus review on low-confidence segments

**2. Conditional Processing:**
- Skip downstream processing for low-confidence transcripts
- Route to human review when below threshold

**3. Quality Metrics:**
- Track transcription quality over time
- Identify problematic audio sources or speakers

### Factors Affecting Confidence

| Factor | Impact |
|--------|--------|
| Background noise | Decreases scores |
| Speaker accents | Varies by training data |
| Domain vocabulary | Technical terms score lower |
| Audio compression | Signal degradation lowers scores |
| Speaking rate | Very fast/slow affects accuracy |

### OpenAI Realtime API - Logprobs

```json
{
  "include": ["item.input_audio_transcription.logprobs"]
}
```

Logprobs can be used to calculate confidence scores from the transcription model's probability outputs.

---

## 5. Correction Mechanisms

### Partial vs Final Results

Real-time transcription uses a two-phase result system:

**Interim/Partial Results:**
- Preliminary guesses as audio streams in
- May change as more context arrives
- `is_final: false`
- Useful for immediate visual feedback

**Final Results:**
- Maximum accuracy achieved for segment
- Will not change
- `is_final: true`
- Safe to store/process

### Deepgram Example Flow

```json
// Interim result (may change)
{
  "is_final": false,
  "transcript": "another big",
  "words": [
    {"word": "another", "confidence": 0.95883},
    {"word": "big", "confidence": 0.96003}
  ]
}

// Later interim (refined)
{
  "is_final": false,
  "transcript": "another big problem",
  "words": [
    {"word": "another", "confidence": 0.99398},
    {"word": "big", "confidence": 0.98220},
    {"word": "problem", "confidence": 0.99534}
  ]
}

// Final result
{
  "is_final": true,
  "speech_final": true,
  "transcript": "Another big problem in healthcare..."
}
```

### Endpointing

Detects pauses in speech to trigger final results:

| Setting | Behavior |
|---------|----------|
| `endpointing=10` | Finalize after 10ms silence (very aggressive) |
| `endpointing=300` | Finalize after 300ms silence (balanced) |
| `endpointing=500` | Finalize after 500ms silence (conservative) |
| `endpointing=false` | Disable, use chunking algorithms |

**Voice Activity Detection (VAD):** Monitors audio for speech vs. silence, controls when to commit audio buffer.

### UI Correction Patterns

**1. Replace-in-Place:**
- Show partial results immediately
- Replace with updated text as corrections arrive
- Final results lock in place

**2. Confidence-Based Styling:**
```css
.word-high-confidence { opacity: 1.0; }
.word-medium-confidence { opacity: 0.8; color: #666; }
.word-low-confidence { opacity: 0.6; text-decoration: underline dotted; }
```

**3. Animation Smoothing:**
- Fade transitions when words change
- Avoid jarring text jumps
- Consider typing animation for new words

**4. Manual Override:**
- Allow users to click and correct words
- Store corrections for model improvement
- Distinguish user edits from auto-corrections

---

## 6. Live Caption UI Best Practices

### Display Considerations

**Timing:**
- Text should appear within 2-3 seconds of speech
- Sub-second latency preferred for voice agents
- Balance accuracy vs. perceived responsiveness

**Formatting:**
- Proper punctuation and capitalization
- Line breaks at natural phrase boundaries
- Speaker identification labels

**Accessibility (WCAG):**
- Sufficient contrast (4.5:1 minimum)
- Adjustable font size
- Customizable colors and positioning
- Option to pause/review captions

### Caption Display Patterns

**Rolling/Scrolling:**
```
[Oldest line fades out]
Speaker A: The meeting will begin shortly.
Speaker B: Thank you, I'm ready to present.
[New lines appear at bottom]
```

**Two-Line Fixed:**
```
Speaker A: The meeting will begin shortly.
Speaker B: Thank you, I'm ready to present. ← Current
```

**Karaoke Style:**
- Highlight current word being spoken
- Works well for single speaker
- Helps with speech pacing visualization

### Real-Time Caption Requirements

| Requirement | Specification |
|-------------|---------------|
| Latency | < 2-3 seconds |
| Accuracy | > 95% for clear audio |
| Speaker labels | Required for multi-speaker |
| Timestamps | Word-level for sync |
| Error indication | Visual cue for uncertainty |

---

## 7. Provider Comparison

### Key Features by Provider

| Feature | Deepgram | AssemblyAI | OpenAI Realtime | Azure Speech |
|---------|----------|------------|-----------------|--------------|
| Streaming | ✅ WebSocket | ✅ WebSocket | ✅ WebSocket/WebRTC | ✅ SDK |
| Interim results | ✅ Optional | ✅ Always on | ✅ Delta events | ✅ |
| Speaker diarization | ✅ | ✅ (multichannel) | ❌ | ✅ Real-time |
| Confidence scores | ✅ Word-level | ✅ | ✅ Logprobs | ✅ |
| Punctuation | ✅ Smart format | ✅ Auto | ✅ | ✅ |
| Endpointing | ✅ Configurable | ✅ | ✅ VAD | ✅ |
| Noise reduction | ✅ | ✅ | ✅ Near/far field | ✅ |

### Latency Characteristics

- **Partial results:** 200-300ms (all providers)
- **Final results:** 1-3 seconds depending on endpointing settings
- **Network overhead:** 50-100 Kbps for audio upload

---

## 8. Implementation Architecture

### Typical Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  Microphone │───▶│ Audio Buffer │───▶│ WebSocket   │
│  (24kHz)    │    │ (chunks)     │    │ Connection  │
└─────────────┘    └──────────────┘    └──────┬──────┘
                                              │
                   ┌──────────────────────────┘
                   ▼
          ┌────────────────┐
          │  ASR Service   │
          │ (Deepgram,     │
          │  AssemblyAI,   │
          │  OpenAI, etc)  │
          └───────┬────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌────────┐  ┌──────────┐  ┌──────────┐
│Partial │  │  Final   │  │ Speaker  │
│Results │  │ Results  │  │  Labels  │
└───┬────┘  └────┬─────┘  └────┬─────┘
    │            │             │
    └────────────┼─────────────┘
                 ▼
         ┌───────────────┐
         │  Caption UI   │
         │ (with styling │
         │  & animation) │
         └───────────────┘
```

### Audio Format Requirements

| Format | Sample Rate | Use Case |
|--------|-------------|----------|
| PCM (Linear16) | 16kHz or 24kHz | Microphone input |
| G.711 μ-law | 8kHz | Telephony |
| G.711 A-law | 8kHz | Telephony |

---

## 9. Voice AI Specific Considerations

### For Voice Agents

**User Speech Transcription:**
- Show what user is saying in real-time
- Helps with perceived responsiveness
- Visual feedback that system is "listening"

**AI Response Transcription:**
- Display AI speech as captions
- Accessibility requirement
- Helps in noisy environments

**Turn-Taking:**
- Clear visual indication of who is speaking
- Distinguish user vs. AI segments
- Handle interruptions gracefully

### Recommended Settings for Voice Agents

```javascript
{
  // Low latency for responsiveness
  endpointing: 300,        // 300ms silence threshold
  interim_results: true,   // Show immediate feedback
  
  // Formatting for readability
  smart_format: true,      // Punctuation, casing, ITN
  punctuate: true,
  
  // Quality features
  noise_reduction: "near_field",  // For close-mic
  vad_events: true,        // Voice activity detection
  
  // Optional
  diarize: true,           // If multi-speaker
  confidence: true         // For UI styling
}
```

---

## Sources

1. AssemblyAI - Real-Time Speech to Text Guide
   https://www.assemblyai.com/blog/real-time-speech-to-text

2. AssemblyAI - Automatic Punctuation, Casing, and ITN
   https://www.assemblyai.com/blog/boosting-transcript-readability-with-automatic-punctuation-and-casing-and-itn

3. Microsoft Azure - Real-Time Diarization GA Announcement
   https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/announcing-general-availability-of-real-time-diarization/4147556

4. Speechmatics - Speaker Diarization in Voice AI
   https://www.speechmatics.com/company/articles-and-news/what-is-speaker-diarization-and-why-does-it-matter-in-voice-ai

5. Deepgram - Interim Results Documentation
   https://developers.deepgram.com/docs/interim-results

6. Deepgram - Endpointing Documentation
   https://developers.deepgram.com/docs/endpointing

7. OpenAI - Realtime Transcription API
   https://platform.openai.com/docs/guides/realtime-transcription

8. FutureBeeAI - Word Confidence Score in ASR
   https://www.futurebeeai.com/knowledge-hub/word-confidence-score-asr

9. Wikipedia - Speaker Diarisation
   https://en.wikipedia.org/wiki/Speaker_diarisation

---

## Confidence Assessment

**High Confidence:**
- Streaming transcription architecture and flow
- Interim/final results mechanism
- Punctuation and ITN processing
- Basic confidence score concepts

**Medium Confidence:**
- Specific latency numbers (vary by provider and network)
- Diarization accuracy metrics (rapidly improving)
- Provider feature comparisons (features change frequently)

**Gaps / Needs Verification:**
- Optimal endpointing values for specific use cases
- Real-world DER benchmarks across providers
- Best UI animation libraries for caption display
- Accessibility compliance specifics (WCAG 2.2)

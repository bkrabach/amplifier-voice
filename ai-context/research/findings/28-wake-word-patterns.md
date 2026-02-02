# Wake Word and Always-Listening Patterns for Voice Assistants

## Research Summary

Wake word detection is a specialized keyword spotting (KWS) problem that enables hands-free voice assistant activation. Modern implementations use multi-stage Deep Neural Network (DNN) architectures with on-device processing to balance accuracy, power efficiency, and privacy. The key challenges are minimizing false activations while maintaining high recall, and doing so with minimal power consumption on always-listening devices.

---

## 1. How "Hey Siri" Style Wake Word Detection Works

### Architecture Overview

Apple's "Hey Siri" implementation (documented in their ML research) reveals a sophisticated multi-stage system:

#### Stage 1: Always-On Processor (AOP) Detection
- A **low-power auxiliary processor** (Motion Coprocessor) runs continuously
- Processes audio at 16,000 samples/second
- Converts waveform to spectral frames (~0.01 sec each)
- Uses a **small DNN** (5 layers, 32 hidden units) for initial detection
- Only wakes the main processor when threshold exceeded

```
Audio Input (16kHz) --> Spectrum Analysis --> DNN Acoustic Model --> HMM Decoder --> Score
                        (mel filterbank)     (20 sound classes)    (dynamic prog)
```

#### Stage 2: Main Processor Verification
- Larger DNN (5 layers, 192 hidden units) re-analyzes the audio
- Higher precision model confirms initial detection
- Uses **conformer encoder** with self-attention for modern systems

#### Stage 3: Speaker Identification (Personalization)
- Compares utterance against enrolled user's voice profile
- Creates fixed-length "speaker embedding" vector
- Reduces false triggers from other speakers saying the wake word

#### Stage 4: False Trigger Mitigation (FTM)
Multiple parallel systems analyze the full utterance:
- **Acoustic FTM (aFTM)**: Streaming transformer analyzing audio features
- **Lattice RNN**: Uses ASR decoding lattices to detect uncertain transcriptions
- **Out-of-Domain Language Detector (ODLD)**: Text-based semantic analysis

### DNN Acoustic Model Details

The core model converts acoustic patterns to phonetic probabilities:

```
Input: ~20 frames (0.2 sec audio) as mel filterbank features
Hidden Layers: 5 fully-connected layers (32-192 units depending on power budget)
Output: ~20 sound classes (phonemes for "Hey Siri" + silence + background)
Final Layer: Softmax for probability distribution
```

**Temporal Integration** uses Hidden Markov Model (HMM) dynamic programming:
```
F[i,t] = max{s[i] + F[i,t-1], m[i-1] + F[i-1,t-1]} + q[i,t]
```
Where:
- `q[i,t]` = acoustic model output (log probability for state i at time t)
- `s[i]` = cost for staying in state i
- `m[i]` = cost for moving from state i

### Two-Threshold Detection Strategy

Apple uses a clever **second-chance mechanism**:
1. **Primary threshold**: Normal activation level
2. **Lower threshold**: System enters "sensitive state" for a few seconds
3. If user repeats phrase (even without extra effort), Siri triggers
4. Improves usability without significantly increasing false alarms

---

## 2. Privacy Considerations for Always-Listening

### The Core Privacy Tension

Always-on voice assistants must continuously monitor audio to detect wake words, creating inherent privacy risks:

| Concern | Impact |
|---------|--------|
| Unintended recordings | Captures sensitive conversations before/after wake word |
| Third-party exposure | Guests, children, vulnerable individuals unknowingly recorded |
| Data retention | Recordings may be stored, analyzed, or shared |
| Accidental activations | False triggers capture non-command audio |

### Privacy Incidents (Real Cases)

1. **Amazon Alexa (2019)**: Recorded private conversations and sent to random contacts
2. **Google Assistant (2020)**: Belgian report revealed 1,000+ private recordings in 3 months from unintended activations
3. **Apple Siri (2019)**: "Grading program" had contractors reviewing intimate recordings
4. **Google (2026)**: $68M settlement for voice assistant "spying" - inadequate disclosures about data processing

### Privacy-Preserving Design Patterns

#### Hardware-Level Privacy
```
1. Physical Mute Switches
   - Disconnect microphone circuitry entirely
   - User-controlled, visible state
   - Example: Amazon Echo's red ring indicator

2. Audio Indicator Lights
   - LED activation when microphone engaged
   - Immediate visual feedback on listening state
   - Should be prominent, not subtle

3. Ring Buffer with Deletion
   - Only keep small rolling buffer (1-3 seconds)
   - Discard immediately if no wake word detected
   - Never store pre-wake-word audio to cloud
```

#### Software-Level Privacy
```
1. On-Device Processing (see Section 3)
   - Process wake word locally
   - Only send post-wake-word audio to cloud
   - Modern: On-device ASR for commands too

2. Personalized Detection
   - Enroll owner's voice profile
   - Reject wake words from non-owners
   - Reduces unintended third-party activations

3. Opt-In Consent Models
   - Require explicit consent before enabling
   - Periodic reminders about data collection
   - Clear privacy dashboards with deletion options
```

### Regulatory Requirements

| Regulation | Key Requirements |
|------------|------------------|
| GDPR (EU) | Explicit consent, right to deletion, data minimization |
| CCPA (California) | Disclosure requirements, opt-out rights |
| COPPA (US) | Special protections for children under 13 |

---

## 3. On-Device vs Cloud Processing

### Processing Architecture Comparison

```
CLOUD PROCESSING (Traditional)
+--------+    audio stream    +-------+    results    +--------+
| Device | -----------------> | Cloud | ------------> | Device |
+--------+                    +-------+               +--------+
                                 |
                          - Full ASR
                          - NLU
                          - Response generation

ON-DEVICE PROCESSING (Modern)
+------------------------------------------------------------------+
|                           DEVICE                                  |
|  +-----+    +----------+    +-----+    +-----+                   |
|  | Mic | -> | Wake Word| -> | ASR | -> | NLU | -> Response       |
|  +-----+    | Detector |    +-----+    +-----+                   |
|             +----------+                                          |
|                 |                                                 |
|            Always-On                                              |
|            Processor                                              |
+------------------------------------------------------------------+
```

### On-Device Benefits

| Benefit | Implementation |
|---------|----------------|
| **Privacy** | Audio never leaves device for wake word detection |
| **Latency** | No network round-trip for initial detection (~100ms vs ~500ms+) |
| **Offline** | Works without internet connectivity |
| **Power** | Dedicated low-power processor for always-on detection |
| **Reliability** | No dependency on cloud availability |

### Apple's Two-Pass On-Device Architecture

```
Pass 1: Always-On Processor (AOP)
- Motion Coprocessor (ARM Cortex-M class)
- Small DNN: 5 layers x 32 units
- Power: ~1mW continuous
- Purpose: High-recall initial screen

Pass 2: Application Processor (AP)  
- Main CPU (woken only on detection)
- Large DNN: 5 layers x 192 units
- Purpose: High-precision verification
```

### Edge Device Constraints

For embedded systems (ESP32, microcontrollers):

| Constraint | Typical Limit | Mitigation |
|------------|---------------|------------|
| Memory | 512KB - 4MB | Quantized models (4-bit weights) |
| Compute | 240MHz dual-core | Streaming inference, no reprocessing |
| Power | Battery operated | Duty cycling, low-power mode |
| Model Size | <500KB | Pruning, distillation, compression |

### Open-Source On-Device Solutions

1. **Picovoice Porcupine**
   - Cross-platform (Cortex-M, RPi, iOS, Android)
   - Pre-trained wake words + custom training
   - Highly optimized DNN implementation

2. **openWakeWord**
   - Python-based, uses speech embedding model
   - Easy custom word training
   - Runs on server or powerful edge devices

3. **microWakeWord**
   - Designed for ESP32-S3
   - Inception-based streaming model
   - ~6ms inference time per audio slice
   - Integrates with ESPHome/Home Assistant

---

## 4. False Positive Handling

### Types of False Triggers

| Type | Example | Cause |
|------|---------|-------|
| **Phonetic similarity** | "Seriously" triggers "Siri" | Similar sound patterns |
| **Background speech** | TV says "Hey Siri" | Non-user audio source |
| **Noise artifacts** | Random sounds trigger | Model overfitting |
| **Other speakers** | Guest says wake word | Intended word, wrong user |

### Multi-Stage Mitigation Architecture

```
                     Audio Stream
                          |
                          v
              +------------------------+
              | Stage 1: AOP Detector  |  <-- High recall, some false positives OK
              | (Fast, low-power)      |
              +------------------------+
                          |
                   Detection?
                          |
              +-----------+-----------+
              | No                Yes |
              v                       v
           Discard         +------------------------+
                          | Stage 2: AP Checker    |  <-- High precision
                          | (Larger model)         |
                          +------------------------+
                                      |
                               Detection?
                                      |
                          +-----------+-----------+
                          | No                Yes |
                          v                       v
                       Discard         +------------------------+
                                      | Stage 3: Speaker ID    |  <-- Is it the owner?
                                      +------------------------+
                                                  |
                                           Match?
                                                  |
                                      +-----------+-----------+
                                      | No                Yes |
                                      v                       v
                                   Discard         +------------------------+
                                                  | Stage 4: FTM Systems   |
                                                  | (aFTM, Lattice, ODLD)  |
                                                  +------------------------+
                                                              |
                                                       Valid?
                                                              |
                                                  +-----------+-----------+
                                                  | No                Yes |
                                                  v                       v
                                               Cancel            ACTIVATE SIRI
```

### False Trigger Mitigation Techniques

#### 1. Acoustic-Based FTM (aFTM)
- Streaming transformer encoder
- Analyzes prosody and acoustic characteristics
- Detects if speech is "device-directed" vs background
- Independent of ASR (which can "hallucinate" wake words)

#### 2. ASR Lattice-Based FTM
- Uses beam-search decoding lattices
- True triggers: Single clear hypothesis
- False triggers: Multiple competing hypotheses
- Leverages uncertainty as signal

#### 3. Semantic Analysis (ODLD)
- BERT-style transformer on recognized text
- Distinguishes voice assistant commands from regular speech
- Detects non-vocative uses ("Siri is a voice assistant" vs "Siri, set timer")

### Dataset Design for False Positive Reduction

Key strategies for training robust models:

```python
# Dataset composition for wake word training
training_data = {
    "positive_samples": {
        "wake_word_clean": 10000,      # Clear wake word recordings
        "wake_word_noisy": 10000,      # Wake word with background noise
        "accents_dialects": 5000,      # Diverse speaker recordings
    },
    "negative_samples": {
        "similar_phrases": 5000,       # "Seriously", "Hey Suri", "Serie"
        "background_speech": 50000,    # General conversation
        "background_noise": 20000,     # Music, TV, ambient sounds
        "adversarial": 2000,           # Pitch/tempo shifted near-misses
    }
}
```

### Threshold Calibration

The trade-off between False Accept Rate (FAR) and False Reject Rate (FRR):

```
     FRR (Miss Rate)
         ^
         |
     40% |  *
         |   *
     20% |    *
         |     *  <-- Operating point selection
     10% |      *****
         |          ********
      5% |                  ***********
         +---------------------------------> FAR (False Alarms/Hour)
            0.1   0.5    1     2     5    10
```

**Typical targets:**
- FAR: < 1 false alarm per 10 hours
- FRR: < 5% miss rate for intentional triggers

### Best Practices for False Positive Reduction

1. **Negative sampling**: Include phonetically similar non-wake phrases
2. **Adversarial augmentation**: Pitch/tempo shifts on near-miss phrases  
3. **Environmental diversity**: Train with varied noise conditions
4. **Threshold tuning**: Per-device or per-user calibration
5. **Second-chance mechanism**: Lower threshold for repeat attempts
6. **Server-side validation**: Cloud ASR can cancel false triggers

---

## 5. Implementation Recommendations for Voice Applications

### Minimum Viable Wake Word System

```
1. Pre-trained Model (fastest to deploy)
   - Use Picovoice Porcupine with standard wake words
   - OR use openWakeWord for server-side detection
   
2. Audio Pipeline
   - 16kHz sample rate, mono
   - Mel filterbank features (40-80 bins)
   - ~25ms frame size, ~10ms hop
   
3. Detection Logic
   - Stream audio through model
   - Accumulate scores across frames
   - Trigger when score exceeds threshold
   - Add debouncing (min time between triggers)
```

### Power-Efficient Design

```
// Pseudo-code for efficient wake word detection

class WakeWordDetector:
    def __init__(self):
        self.small_model = load_first_pass_model()   # Always running
        self.large_model = load_second_pass_model()  # Loaded on-demand
        self.ring_buffer = RingBuffer(seconds=1.5)   # Rolling audio
        
    def process_audio(self, audio_chunk):
        self.ring_buffer.append(audio_chunk)
        
        # First pass: low-power, high-recall
        score = self.small_model.infer(audio_chunk)
        
        if score > FIRST_PASS_THRESHOLD:
            # Second pass: higher precision
            full_audio = self.ring_buffer.get_all()
            final_score = self.large_model.infer(full_audio)
            
            if final_score > SECOND_PASS_THRESHOLD:
                return WakeWordDetected(
                    audio=full_audio,
                    confidence=final_score
                )
        
        return None
```

### Privacy-First Implementation Checklist

- [ ] Process wake word detection entirely on-device
- [ ] Use ring buffer that discards non-wake audio immediately  
- [ ] Provide hardware mute option
- [ ] Show visual indicator when listening
- [ ] Support personalized (owner-only) detection
- [ ] Allow users to review and delete recordings
- [ ] Document what audio is retained and for how long
- [ ] Implement opt-in consent flow

---

## Sources

### Primary Sources (Apple ML Research)
- [Hey Siri: An On-device DNN-powered Voice Trigger](https://machinelearning.apple.com/research/hey-siri) - Apple, 2017
- [Voice Trigger System for Siri](https://machinelearning.apple.com/research/voice-trigger) - Apple, 2023

### Open Source Projects
- [Picovoice Porcupine](https://github.com/Picovoice/porcupine) - Commercial wake word engine
- [openWakeWord](https://github.com/dscripka/openWakeWord) - Open-source wake word framework
- [microWakeWord](https://www.kevinahrendt.com/micro-wake-word) - ESP32-optimized streaming detection

### Privacy and Best Practices
- [Voice Assistants and Always-On Listening Best Practices](https://trueaivalues.com/ai-values/privacy-and-consent/voice-assistants-and-always-on-listening-best-practices/)
- [Handling False Positives in Wake Word Datasets](https://www.futurebeeai.com/knowledge-hub/false-positives-wake-word)

### Academic Papers
- "Hello Edge: Keyword Spotting on Microcontrollers" - ARM Research
- "Streaming Keyword Spotting on Mobile Devices" - Google Research
- "Neural Network Exploration for Keyword Spotting on Edge Devices" - MDPI, 2023

---

## Confidence Level

**High confidence** on technical architecture (based on Apple's official ML research publications and open-source implementations). **Medium confidence** on specific power consumption numbers (varies by device). Privacy incidents are well-documented from news sources. Information is current as of late 2023/2024 with iOS 17 references.

## Gaps

- Specific latency benchmarks across different hardware
- Detailed comparison of commercial vs open-source accuracy
- Real-world false positive rates in production deployments
- Cost analysis for custom wake word training

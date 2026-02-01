# Audio Quality and Speech Recognition Accuracy

## Research Summary

Audio quality is the primary determinant of speech recognition accuracy. Key factors include Signal-to-Noise Ratio (SNR), microphone quality, echo cancellation, and audio preprocessing. Modern ASR systems like Whisper achieve 2.7% WER on clean audio but degrade significantly in noisy conditions. Optimal speech recognition requires SNR above 20dB, proper echo cancellation, and appropriate gain control.

---

## 1. Word Error Rate (WER)

### Definition and Formula

WER is the primary metric for evaluating speech recognition accuracy:

```
WER = (Substitutions + Insertions + Deletions) / Total Words in Reference
```

- **Substitutions**: Words incorrectly transcribed
- **Insertions**: Extra words added
- **Deletions**: Words missed/omitted

### Industry Benchmarks

| Model/System | Clean Audio WER | Real-World WER | Notes |
|--------------|-----------------|----------------|-------|
| OpenAI Whisper (large) | 2.7% | 5-15% | English, clean audio |
| Human Transcription | 4-5% | 8-12% | Professional transcribers |
| Commercial ASR (Google, AWS) | 4-8% | 10-20% | Varies by domain |
| Real-time systems | 5-10% | 15-30% | Latency tradeoffs |

### Measurement Best Practices

1. **Normalize text before comparison**:
   - Lowercase conversion
   - Remove punctuation
   - Convert numbers to words (or vice versa)
   - Handle contractions consistently

2. **Use representative test data**:
   - FLEURS dataset benchmarks are optimistic (clean, read speech)
   - Real-world audio shows 2-3x higher WER
   - Include diverse accents, speaking styles, and domains

3. **Calculate using edit distance**:
```python
import editdistance

def calculate_wer(reference: str, hypothesis: str) -> float:
    ref_words = reference.lower().split()
    hyp_words = hypothesis.lower().split()
    return editdistance.eval(ref_words, hyp_words) / len(ref_words)
```

**Sources**: [Way With Words](https://waywithwords.net/resource/speech-recognition-systems-performance/), [Deepgram Benchmarking](https://deepgram.com/learn/benchmarking-openai-whisper-for-non-english-asr)

---

## 2. Noise Robustness and Signal-to-Noise Ratio (SNR)

### SNR Fundamentals

**Definition**: SNR measures the ratio of speech signal power to background noise power, expressed in decibels (dB).

```
SNR (dB) = 10 * log10(Signal Power / Noise Power)
```

Or using RMS values:
```
SNR (dB) = 20 * log10(S_rms / N_rms)
```

### SNR Thresholds and Recognition Accuracy

| SNR Level | Quality | Recognition Impact |
|-----------|---------|-------------------|
| > 30 dB | Clean speech | Optimal recognition, near-human accuracy |
| 20-30 dB | Good | Minimal accuracy degradation |
| 10-20 dB | Moderate | Noticeable WER increase (1.5-2x baseline) |
| 0-10 dB | Poor | Significant degradation (2-4x baseline WER) |
| < 0 dB | Very Poor | Noise overwhelms speech, unreliable recognition |

**Key Finding**: Research indicates that increased word error rates are typically seen at 20dB SNR, with human intelligibility remaining good even at 0dB SNR (where speech and noise energy are equal).

### Noise Types and Impact

| Noise Type | Impact on ASR | Mitigation Difficulty |
|------------|---------------|----------------------|
| White/Stationary noise | Moderate | Easier - predictable spectrum |
| Babble/Competing speech | Severe | Hardest - matches speech spectrum |
| Impulsive noise | Moderate | Variable - can mask phonemes |
| Music | Moderate-High | Complex harmonic interference |
| Environmental (HVAC, traffic) | Low-Moderate | Usually easier with filtering |

### Noise Reduction Strategies

1. **Spectral Subtraction**: Estimate and remove noise spectrum
   - Simple, low computational cost
   - Effective for additive, slowly-varying noise

2. **Wiener Filtering**: Minimize mean-square error
   - Good for stationary noise
   - Preserves speech quality better

3. **Deep Learning Denoising**: Neural network-based enhancement
   - Best for complex, non-stationary noise
   - Higher computational requirements

**Sources**: [Symbl.ai SNR Guide](https://symbl.ai/developers/blog/understanding-speech-to-noise-ratio-and-its-impact-on-your-app/), [Fora Soft Noise Strategies](https://www.forasoft.com/blog/article/speech-recognition-accuracy-noisy-environments)

---

## 3. Microphone Quality Impact

### Key Microphone Factors

| Factor | Impact on Recognition | Recommendation |
|--------|----------------------|----------------|
| Sample Rate | High | 16kHz minimum for speech; 8kHz acceptable for telephony |
| Bit Depth | Moderate | 16-bit standard; 24-bit for professional |
| Frequency Response | High | 80Hz-8kHz minimum for speech |
| Self-Noise | High | Lower is better; <20dB-A ideal |
| Polar Pattern | Moderate | Cardioid reduces ambient noise |

### Sample Rate Guidelines

| Sample Rate | Use Case | Quality |
|-------------|----------|---------|
| 8 kHz | Telephony, legacy systems | Minimum viable |
| 16 kHz | Speech recognition standard | Recommended for ASR |
| 22.05 kHz | Voice AI applications | Good balance |
| 44.1/48 kHz | Professional audio | Overkill for speech-only |

**Important**: Mismatched sampling rates across your audio pipeline cause:
- Recognition errors
- Robotic voice artifacts
- Unnecessary processing delays

### Distance and Placement

- **Optimal distance**: 6-12 inches from speaker
- **Too close**: Plosive distortion, breath noise
- **Too far**: Increased room reverb, lower SNR
- **Off-axis**: Reduced high-frequency capture

**Sources**: [Vapi Sampling Rate Guide](https://vapi.ai/blog/sampling-rate), [Fireflies Quality Factors](https://guide.fireflies.ai/articles/7779872772-factors-that-impact-the-accuracy-and-quality-of-speech-recognition)

---

## 4. Echo Cancellation

### Types of Echo

| Echo Type | Source | Solution |
|-----------|--------|----------|
| Acoustic Echo | Speaker to microphone coupling | AEC algorithms |
| Hybrid/Electronic Echo | 2-to-4 wire conversion (PSTN) | Line echo cancellers |
| Room Reverb | Sound reflections | Dereverberation |

### WebRTC Acoustic Echo Cancellation (AEC)

WebRTC provides built-in AEC through media constraints:

```javascript
const constraints = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  }
};

navigator.mediaDevices.getUserMedia(constraints);
```

### AEC Best Practices

1. **Enable echo cancellation by default** for voice applications
2. **Use loopback technique** for local audio (TTS) cancellation:
   - Route local audio through WebRTC
   - Browser treats it as "remote participant audio"
   - AEC automatically cancels it from microphone input

3. **Provide reference signal** for software AEC:
   - AEC needs to know what audio is being played
   - Loopback audio channel enables this

4. **Consider tail length**:
   - Echo tail = time for sound to travel and reflect back
   - Typical room: 100-200ms tail
   - Large spaces: may need 400ms+

### WebRTC AEC3

Modern WebRTC uses AEC3 (third generation):
- Better handling of non-linear distortion
- Improved double-talk detection
- Lower latency than previous versions

**Sources**: [Telecom Altanai AEC Guide](https://telecom.altanai.com/2022/03/09/aec-echo-cancellation-in-webrtc/), [GitHub Browser AEC Demo](https://github.com/nguyenvulebinh/browser-aec)

---

## 5. Audio Preprocessing

### Automatic Gain Control (AGC)

**Purpose**: Dynamically adjust audio levels to normalize volume.

**Benefits**:
- Compensates for varying speaker distances
- Handles soft speakers and loud speakers
- Accounts for uncalibrated microphones

**Drawbacks**:
- Can amplify background noise during pauses
- May affect music/non-speech audio quality
- Successive processing can make gain issues worse

**Best Practice**: Only update gain when voice is detected:

```javascript
// Example: AGC with VAD (Voice Activity Detection)
// Only adjust gain during active speech
// Use libraries like rnnoise-wasm for VAD
```

### Noise Suppression

**WebRTC constraint**:
```javascript
{ audio: { noiseSuppression: true } }
```

**Warning**: For `VOICE_RECOGNITION` use cases on Android, noise suppression preprocessing should NOT be enabled by default - it can interfere with ASR accuracy.

### Microsoft Audio Stack Components

Microsoft's speech processing pipeline includes:
1. **Noise Suppression** - Reduce background noise
2. **Beamforming** - Localize sound origin (multi-mic)
3. **Dereverberation** - Reduce room reflections
4. **AEC** - Cancel played audio from input
5. **AGC** - Normalize levels

**Key Requirement**: Raw, unprocessed audio yields best results. Pre-processed audio limits the stack's enhancement ability.

### Preprocessing Pipeline Order

Recommended order for speech recognition:

```
Input -> High-Pass Filter (remove DC/rumble)
      -> AEC (if playback present)
      -> Noise Suppression
      -> AGC (with VAD gating)
      -> Resampling (if needed)
      -> ASR Engine
```

**Sources**: [Microsoft Audio Processing](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/audio-processing-overview), [SpeexDSP Preprocessing](https://deepwiki.com/xiph/speexdsp/2.2-audio-preprocessing)

---

## 6. WebRTC Audio Constraints Reference

### Complete Audio Constraints

```javascript
const audioConstraints = {
  audio: {
    // Echo cancellation
    echoCancellation: { ideal: true },
    
    // Noise suppression
    noiseSuppression: { ideal: true },
    
    // Automatic gain control
    autoGainControl: { ideal: true },
    
    // Sample rate (Hz)
    sampleRate: { ideal: 16000 },
    
    // Sample size (bits)
    sampleSize: { ideal: 16 },
    
    // Channel count
    channelCount: { ideal: 1 },  // Mono for speech
    
    // Latency (seconds)
    latency: { ideal: 0.01 }  // Low latency for real-time
  }
};
```

### When to Disable Processing

Disable audio processing for:
- **Music applications**: Processing degrades quality
- **Medical audio**: Need accurate waveforms
- **When using external processing**: Avoid double-processing

```javascript
// Raw audio capture (no processing)
const rawAudioConstraints = {
  audio: {
    echoCancellation: false,
    noiseSuppression: false,
    autoGainControl: false
  }
};
```

**Source**: [MDN MediaTrackConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints)

---

## 7. Practical Recommendations

### For Voice AI Applications

1. **Target SNR > 20dB** for reliable recognition
2. **Use 16kHz sample rate** as minimum standard
3. **Enable WebRTC AEC** when system plays audio
4. **Implement VAD-gated AGC** to avoid amplifying silence
5. **Test with real-world noise** - benchmark datasets are optimistic
6. **Monitor WER in production** - track accuracy over time

### Audio Quality Checklist

- [ ] Microphone captures at 16kHz or higher
- [ ] Echo cancellation enabled for duplex audio
- [ ] Noise suppression appropriate for environment
- [ ] AGC enabled with VAD gating
- [ ] No sample rate mismatches in pipeline
- [ ] Latency acceptable for use case
- [ ] Tested with representative noise conditions

### Expected Performance

| Condition | Expected WER Range |
|-----------|-------------------|
| Clean, close-mic | 2-5% |
| Quiet room, good mic | 5-10% |
| Office environment | 10-15% |
| Noisy environment | 15-30% |
| Very noisy (< 10dB SNR) | 30%+ |

---

## Sources

1. [Way With Words - 10 Metrics for Speech Recognition](https://waywithwords.net/resource/speech-recognition-systems-performance/)
2. [Symbl.ai - Speech-to-Noise Ratio Guide](https://symbl.ai/developers/blog/understanding-speech-to-noise-ratio-and-its-impact-on-your-app/)
3. [Deepgram - Benchmarking OpenAI Whisper](https://deepgram.com/learn/benchmarking-openai-whisper-for-non-english-asr)
4. [Fora Soft - Noisy Speech Recognition Strategies](https://www.forasoft.com/blog/article/speech-recognition-accuracy-noisy-environments)
5. [Telecom Altanai - WebRTC AEC and AGC](https://telecom.altanai.com/2022/03/09/aec-echo-cancellation-in-webrtc/)
6. [Microsoft - Audio Processing Overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/audio-processing-overview)
7. [MDN - MediaTrackConstraints](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints)
8. [Vapi - Sampling Rate in Voice AI](https://vapi.ai/blog/sampling-rate)
9. [SpeexDSP - Audio Preprocessing](https://deepwiki.com/xiph/speexdsp/2.2-audio-preprocessing)
10. [GitHub - Browser AEC Demo](https://github.com/nguyenvulebinh/browser-aec)

---

**Research Date**: January 2026  
**Confidence Level**: High - Information from authoritative sources including MDN, Microsoft, and industry practitioners.  
**Gaps**: Specific dB thresholds for ASR degradation vary by system; real-world testing recommended for target environment.

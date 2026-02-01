# Mobile Voice Assistant Development Considerations

## Research Summary

Mobile voice assistant development requires navigating significant platform differences between iOS and Android, managing complex audio session handling for background operation, and making critical architectural decisions around push-to-talk vs always-listening modes. Cross-platform frameworks like React Native and Flutter offer viable voice libraries, but developers must understand native platform constraints around battery consumption, rate limits, and API capabilities.

---

## 1. iOS and Android Voice API Differences

### iOS: Speech Framework (SFSpeechRecognizer)

**Core Components:**
- `SFSpeechRecognizer` - Central object for managing speech recognition
- `SFSpeechRecognitionRequest` - Base class for recognition tasks
- `SFSpeechAudioBufferRecognitionRequest` - Live audio stream recognition
- `SFSpeechURLRecognitionRequest` - Pre-recorded file recognition

**Key Capabilities:**
- On-device recognition available since iOS 13 (`requiresOnDeviceRecognition = true`)
- Cloud-based recognition for higher accuracy
- Speaking rate detection, confidence levels, word timestamps
- Multiple language support with locale selection

**iOS-Specific Limitations:**
- **Rate Limit**: 1,000 requests per hour per device (not per app)
- **Duration Limit**: ~1 minute per recognition session
- Requires explicit permissions: `NSSpeechRecognitionUsageDescription`, `NSMicrophoneUsageDescription`
- On-device recognition has reduced accuracy compared to cloud

**Code Pattern (iOS):**
```swift
let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
let request = SFSpeechAudioBufferRecognitionRequest()
request.requiresOnDeviceRecognition = true // Offline mode
request.shouldReportPartialResults = true
```

### Android: SpeechRecognizer API

**Core Components:**
- `SpeechRecognizer` - Main class for speech recognition service
- `RecognitionListener` - Callback interface for results
- `Intent` with `ACTION_RECOGNIZE_SPEECH` - Launch recognition

**Key Capabilities:**
- On-device recognition via `createOnDeviceSpeechRecognizer(Context)`
- Cloud recognition via `createSpeechRecognizer(Context)` (Google's service)
- Offline speech recognition packages available for download
- Supports continuous partial results

**Android-Specific Limitations:**
- **Short Pause Timeout**: Recognition stops after ~5 seconds of silence (device-dependent)
- System sounds on start/stop cannot be disabled
- Not designed for continuous recognition (significant battery/bandwidth impact)
- Requires SDK 30+ manifest additions for service queries

**Required Permissions:**
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.BLUETOOTH"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT"/>

<!-- For SDK 30+ -->
<queries>
    <intent>
        <action android:name="android.speech.RecognitionService" />
    </intent>
</queries>
```

### Platform Comparison Matrix

| Feature | iOS | Android |
|---------|-----|---------|
| On-device recognition | iOS 13+ | Varies by device |
| Rate limiting | 1000 req/hour device-wide | No explicit limit |
| Max session duration | ~1 minute | No hard limit (pause timeout) |
| Pause timeout | Configurable | ~5 seconds (not configurable) |
| System sounds | None by default | Cannot disable |
| Offline languages | Limited | Downloadable packages |
| Background operation | Restricted | Restricted |

---

## 2. Background Audio Handling

### iOS AVAudioSession

**Audio Session Categories:**
- `.playAndRecord` - Required for voice apps (record + playback)
- `.record` - Recording only
- `.playback` - Playback only

**Background Modes (Info.plist):**
```xml
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

**Critical Considerations:**
- Background recording is technically possible but **unreliable**
- App termination or force-quit stops recording
- Other apps requesting audio can interrupt your session
- iOS 16+ has stricter background recording enforcement
- Must handle audio session interruptions gracefully

**Session Configuration:**
```swift
let session = AVAudioSession.sharedInstance()
try session.setCategory(.playAndRecord, mode: .voiceChat, options: [
    .allowBluetooth,
    .defaultToSpeaker,
    .mixWithOthers
])
try session.setActive(true)
```

**Interaction with Other Audio:**
- Haptic feedback can conflict with audio sessions
- WebRTC and other audio plugins may cause crashes
- Recommended: Add brief delays between audio plugin operations

### Android Audio Handling

**AudioManager and AudioRecord:**
- Use `VOICE_COMMUNICATION` audio source for preprocessing
- `AudioFocusRequest` for managing audio focus
- Foreground service required for reliable background audio

**Background Service Pattern:**
```kotlin
class VoiceService : Service() {
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification())
        // Initialize audio recording
        return START_STICKY
    }
}
```

**Permissions for Background:**
```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE"/>
```

### Platform Comparison - Background Audio

| Aspect | iOS | Android |
|--------|-----|---------|
| Background recording | Limited, unreliable | Foreground service required |
| App termination | Stops recording | Sticky service can restart |
| Audio interruptions | Must handle gracefully | AudioFocus management |
| User notification | Not required | Foreground notification mandatory |

---

## 3. Push-to-Talk vs Always-Listening

### Push-to-Talk (PTT)

**Advantages:**
- Minimal battery consumption
- No privacy concerns during idle
- Clear user intent signal
- Works reliably across all platforms
- No wake word false positives

**Implementation Considerations:**
- UI affordance needed (button, gesture)
- Haptic/audio feedback for state changes
- Consider accessibility for hands-free scenarios

**Best For:**
- Voice commands in focused contexts
- Privacy-sensitive applications
- Battery-critical use cases
- Noisy environments

### Always-Listening (Wake Word Detection)

**Technical Approaches:**

1. **Hardware DSP (Dedicated Chip)**
   - Ultra-low power (~1mW)
   - Limited to device manufacturers
   - Examples: Apple's "Hey Siri", Google's hotword chip

2. **Software Wake Word Detection**
   - Libraries: Picovoice Porcupine, Snowboy (discontinued), OpenWakeWord
   - Runs on main CPU
   - Higher battery consumption than DSP

3. **Hybrid Approach**
   - Low-power voice activity detection (VAD)
   - Wake up heavier processing only on voice detected

**Picovoice Porcupine (Recommended Library):**
- Cross-platform: iOS, Android, Web, embedded
- On-device processing (no cloud)
- Custom wake words via console
- ~6.5x faster than alternatives (benchmark vs PocketSphinx)
- Supports 17+ languages
- Free tier available

```javascript
// React Native Porcupine example
import { Porcupine } from '@picovoice/porcupine-react-native';

const porcupine = await Porcupine.fromKeywords(
  accessKey,
  ['picovoice', 'bumblebee'],
  (keywordIndex) => {
    console.log(`Wake word detected: ${keywordIndex}`);
  }
);
```

**Power Consumption Comparison:**

| Mode | Typical Power Draw | Battery Impact |
|------|-------------------|----------------|
| Hardware DSP wake word | ~1mW | Negligible |
| Software wake word (optimized) | ~50-100mW | Moderate |
| Continuous speech recognition | ~500mW+ | High |
| Push-to-talk (idle) | ~0mW | None |

### Recommendation

For mobile voice assistants:
1. **Default to Push-to-Talk** for most use cases
2. **Use Porcupine** if always-listening is required
3. **Never use continuous speech recognition** for wake word detection
4. Consider **hybrid**: PTT primary + optional always-listening mode

---

## 4. Battery Optimization for Voice Apps

### General Principles

1. **Minimize Always-On Processing**
   - Use hardware VAD when available
   - Implement aggressive timeouts
   - Batch network requests

2. **On-Device vs Cloud Trade-offs**
   - On-device: No network, but CPU-intensive
   - Cloud: Network overhead, but offloads processing
   - Recommendation: On-device for short commands, cloud for complex transcription

3. **Audio Buffer Management**
   - Use appropriate sample rates (16kHz often sufficient for speech)
   - Process in efficient chunk sizes
   - Release audio resources immediately when not needed

### iOS-Specific Optimizations

```swift
// Use appropriate audio session mode
try session.setMode(.voiceChat) // Optimized for voice

// Release recognition resources
recognitionTask?.cancel()
recognitionTask = nil

// Use on-device when accuracy trade-off acceptable
request.requiresOnDeviceRecognition = true
```

**iOS Guidelines from Apple:**
- Plan for 1-minute maximum recognition sessions
- Implement visual indicators when recording
- Don't perform recognition on sensitive data
- Handle rate limit failures gracefully

### Android-Specific Optimizations

```kotlin
// Use efficient audio source
val audioSource = MediaRecorder.AudioSource.VOICE_RECOGNITION

// Implement proper lifecycle management
override fun onPause() {
    speechRecognizer.stopListening()
    super.onPause()
}

// Use WorkManager for deferred processing
val workRequest = OneTimeWorkRequestBuilder<TranscriptionWorker>()
    .setConstraints(Constraints.Builder()
        .setRequiredNetworkType(NetworkType.UNMETERED)
        .setRequiresBatteryNotLow(true)
        .build())
    .build()
```

### Battery Impact Measurements

| Operation | Relative Power | Duration Impact |
|-----------|---------------|-----------------|
| Microphone active | High | Continuous |
| Speech recognition (cloud) | Very High | Network + CPU |
| Speech recognition (local) | High | CPU intensive |
| Wake word detection (Porcupine) | Medium | Optimized ML |
| Audio playback | Medium | Duration-based |
| Idle with listeners | Low | Event-driven |

---

## 5. Cross-Platform Voice Libraries

### React Native

#### @react-native-voice/voice

**Status:** Most popular React Native voice library
**Version:** 3.2.4 (last published 3 years ago - maintenance mode)
**Support:** iOS and Android, online and offline

**Features:**
- Native bridge to platform speech APIs
- Partial results support
- Multiple language support
- Error handling callbacks

**Installation:**
```bash
npm install @react-native-voice/voice
# or
yarn add @react-native-voice/voice
```

**Basic Usage:**
```javascript
import Voice from '@react-native-voice/voice';

Voice.onSpeechResults = (e) => {
  console.log('Results:', e.value);
};

Voice.onSpeechPartialResults = (e) => {
  console.log('Partial:', e.value);
};

await Voice.start('en-US');
// ... later
await Voice.stop();
```

**Limitations:**
- Inherits all platform limitations
- Not actively maintained (consider alternatives)
- No built-in wake word support

#### Alternatives for React Native

| Library | Use Case | Status |
|---------|----------|--------|
| @picovoice/porcupine-react-native | Wake word detection | Active |
| @picovoice/rhino-react-native | Speech-to-intent | Active |
| expo-speech | TTS only | Active |
| react-native-whisper | Local transcription | Emerging |

### Flutter

#### speech_to_text (Recommended)

**Status:** Actively maintained, most popular Flutter voice package
**Version:** 7.3.0+ 
**Support:** Android, iOS, macOS, Web, Windows (beta)

**Features:**
- Platform-specific speech recognition
- Locale/language selection
- Partial results
- Error and status callbacks
- Sound feedback support (iOS)

**Installation:**
```yaml
dependencies:
  speech_to_text: ^7.3.0
```

**Basic Usage:**
```dart
import 'package:speech_to_text/speech_to_text.dart' as stt;

final speech = stt.SpeechToText();
bool available = await speech.initialize(
  onStatus: (status) => print('Status: $status'),
  onError: (error) => print('Error: $error'),
);

if (available) {
  speech.listen(
    onResult: (result) => print('Result: ${result.recognizedWords}'),
    localeId: 'en_US',
  );
}

// Stop listening
speech.stop();
```

**Platform Requirements:**

iOS (Info.plist):
```xml
<key>NSSpeechRecognitionUsageDescription</key>
<string>Speech recognition for voice commands</string>
<key>NSMicrophoneUsageDescription</key>
<string>Microphone access for voice input</string>
```

Android (AndroidManifest.xml):
```xml
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.INTERNET"/>
```

**Known Issues:**
- macOS: Permission requests crash in VSCode (use Xcode)
- Android: 5-second pause timeout
- Web: Limited browser support (Chrome best)
- Not designed for continuous recognition

#### Flutter Voice Library Comparison

| Package | Downloads | Platforms | Maintenance |
|---------|-----------|-----------|-------------|
| speech_to_text | 201k weekly | iOS, Android, macOS, Web, Windows | Active |
| flutter_tts | High | iOS, Android, Web | Active |
| porcupine_flutter | Moderate | iOS, Android | Active |

### Cross-Platform Recommendations

| Requirement | React Native | Flutter |
|-------------|--------------|---------|
| Basic voice commands | @react-native-voice/voice | speech_to_text |
| Wake word detection | @picovoice/porcupine-react-native | porcupine_flutter |
| Text-to-speech | expo-speech or native | flutter_tts |
| Real-time transcription | Custom WebSocket | Custom WebSocket |

---

## 6. Architecture Recommendations

### For Voice Command Apps (Short Phrases)

```
[Microphone] -> [PTT Button] -> [Platform Speech API] -> [Command Parser]
                                         |
                            [On-device for privacy/speed]
```

### For Voice Assistant Apps (Always-Listening)

```
[Microphone] -> [Wake Word Engine] -> [Speech Recognition] -> [NLU/Intent]
     |              (Porcupine)           (Platform API)
     |                  |
[Low-power VAD]   [Activate on keyword]
```

### For Conversation/Dictation Apps

```
[Microphone] -> [PTT/VAD] -> [Streaming ASR] -> [Cloud Service]
                                   |
                          [WebSocket connection]
                          [Whisper API / Google STT]
```

---

## 7. Key Takeaways

1. **Platform APIs are fundamentally different** - Abstract carefully in cross-platform apps
2. **iOS has hard rate limits** (1000 req/hr) - Implement caching and fallbacks
3. **Android has short pause timeouts** - Cannot be changed, design UX around it
4. **Background audio is unreliable** on both platforms - Don't depend on it
5. **Push-to-talk is always more battery efficient** than always-listening
6. **Use Picovoice Porcupine** for wake word detection, never continuous speech recognition
7. **speech_to_text (Flutter)** is more actively maintained than React Native alternatives
8. **Plan for ~1 minute max** recognition sessions on iOS
9. **Test on real devices** - Simulators have different speech recognition behavior
10. **Handle permissions gracefully** - Both platforms require explicit user consent

---

## Sources

- Apple Developer Documentation: Speech Framework
  - https://developer.apple.com/documentation/speech
  - https://developer.apple.com/library/archive/qa/qa1951/_index.html
- Android Developers: SpeechRecognizer API
  - https://developer.android.com/reference/android/speech/SpeechRecognizer
- Flutter speech_to_text Package
  - https://pub.dev/packages/speech_to_text
  - https://github.com/csdcorp/speech_to_text
- React Native Voice Library
  - https://github.com/react-native-voice/voice
  - https://www.npmjs.com/package/@react-native-voice/voice
- Picovoice Porcupine Wake Word Engine
  - https://github.com/Picovoice/porcupine
  - https://picovoice.ai/docs/porcupine/
- iOS AVAudioSession
  - https://developer.apple.com/documentation/avfaudio/avaudiosession

---

**Research Date:** January 2026
**Confidence Level:** High - Based on official documentation and actively maintained libraries
**Gaps:** Specific battery consumption benchmarks vary by device; real-world testing recommended

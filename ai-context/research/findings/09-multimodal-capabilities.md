# Multi-Modal Capabilities in OpenAI Realtime API

## Research Summary

OpenAI's Realtime API now fully supports multi-modal input including images alongside audio and text (as of August 2025 GA release). Video streaming via WebRTC is supported but processed as periodic image snapshots rather than continuous video analysis. The combination of voice + vision enables powerful use cases like asking the AI to describe what it sees or read text from screenshots.

---

## 1. Image Input Support

### Current Status: **Fully Supported** (as of gpt-realtime GA - August 2025)

Image input was added with the gpt-realtime model release. The API now accepts images, photos, and screenshots alongside audio or text in a Realtime session.

### How to Send Images

Images are sent via the `conversation.item.create` event:

```json
{
  "type": "conversation.item.create",
  "previous_item_id": null,
  "item": {
    "type": "message",
    "role": "user",
    "content": [
      {
        "type": "input_image",
        "image_url": "data:image/png;base64,{base64_encoded_image_data}"
      }
    ]
  }
}
```

### Image Input Options

| Method | Format | Notes |
|--------|--------|-------|
| Base64 Data URL | `data:image/{format};base64,{data}` | Most common, works reliably |
| Hosted URL | Standard HTTP(S) URL | May work (key name implies support) |
| File ID | OpenAI Files API reference | Upload with `purpose: vision` |

### Combining Text and Images

```json
{
  "type": "conversation.item.create",
  "item": {
    "type": "message",
    "role": "user",
    "content": [
      {"type": "input_text", "text": "What do you see in this image?"},
      {"type": "input_image", "image_url": "data:image/png;base64,..."}
    ]
  }
}
```

### Limitations

- WebRTC data channels have size limits for base64 payloads
- Large images may need to be sent via hosted URLs or Files API
- Documentation on image input is still sparse in official docs

---

## 2. Video / Screen Sharing Support

### Current Status: **Supported via WebRTC** (with important caveats)

### How Video Works

Video is transmitted via standard WebRTC media tracks, but the model does **NOT** process continuous video streams. Instead:

1. Video stream is sent to OpenAI's servers via WebRTC
2. A gateway converts the stream to periodic image snapshots
3. When user asks about visual content, a snapshot is captured
4. The snapshot is processed as an image input
5. User is charged for image tokens, not video

### Implementation

```javascript
// Enable video capture
const videoConstraints = {
  width: { ideal: 1920 },
  height: { ideal: 1080 },
  frameRate: { ideal: 1 }  // Low FPS recommended - saves bandwidth
};

const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: videoConstraints
});

// Add tracks to peer connection
stream.getTracks().forEach(track => {
  peerConnection.addTrack(track, stream);
});
```

### Recommendations from OpenAI

- **High resolution, low FPS**: Since video is converted to snapshots, 1 FPS is sufficient
- Resolution of 1080p works well
- Can save bandwidth by sending lower resolution or enabling video selectively

### Video Codec Support

- H.264 only (baseline, constrained baseline, main, high profiles)
- No simulcast or RTX support
- Hardware acceleration supported on most devices

### Vision Pricing (Estimated)

Based on testing, image analysis costs approximately **$0.067-0.068 per image** regardless of resolution (uses "low" detail level internally).

---

## 3. Multi-Modal Interaction Capabilities

### Supported Input Modalities

| Modality | Status | Notes |
|----------|--------|-------|
| Audio | Fully Supported | Primary modality, speech-to-speech |
| Text | Fully Supported | Can inject text into conversation |
| Images | Fully Supported | Static images via conversation items |
| Video Stream | Partial | Converted to periodic snapshots |

### Supported Output Modalities

| Modality | Status | Notes |
|----------|--------|-------|
| Audio | Fully Supported | Natural speech synthesis |
| Text | Fully Supported | Transcripts and text responses |
| Images | NOT Supported | Cannot generate images |
| Video | NOT Supported | No video output |

### Key Capabilities

1. **Non-Verbal Signal Recognition**: Detects laughter, pauses, emotional cues
2. **Language/Tone Adaptation**: Can switch languages mid-conversation
3. **Visual Context Grounding**: Can answer questions about images/screenshots
4. **Multimodal Reasoning**: Combines audio, text, and visual inputs for responses

---

## 4. Vision + Voice Integration

### Use Cases Enabled

| Use Case | Description |
|----------|-------------|
| Visual Q&A | "What do you see?" / "Describe this image" |
| Screen Reading | "Read the text in this screenshot" |
| Object Identification | "What is this thing I'm showing you?" |
| Document Analysis | Analyze receipts, forms, labels via camera |
| Educational Support | Visual problem-solving with voice explanation |
| Accessibility | Describe environments for visually impaired users |

### Example Interaction Flow

1. User enables camera/video
2. User asks: "What do you see on my screen?"
3. API captures snapshot from video stream
4. Model analyzes image
5. Model responds via audio: "I can see a spreadsheet with..."

### ChatGPT Advanced Voice Mode Comparison

ChatGPT's consumer product has had live video/screen sharing since December 2024:
- Rolled out to Plus/Pro/Teams users
- Supports 50+ languages
- Same underlying technology as Realtime API
- API developers now have access to same capabilities

---

## 5. Future Roadmap & Recent Updates

### August 2025 GA Release Highlights

1. **gpt-realtime model**: New production-ready voice model
2. **Image input**: First official multimodal input support
3. **20% price reduction**: Audio input now $32/1M tokens, output $64/1M tokens
4. **Remote MCP support**: Model Context Protocol for tool integration
5. **SIP phone integration**: Direct telephony support

### Announced/Implied Future Capabilities

| Feature | Status | Timeline |
|---------|--------|----------|
| More voice options | Released | Marin, Cedar voices added |
| Improved instruction following | Released | 30.5% on MultiChallenge (up from 20.6%) |
| Better reasoning | Released | 82.8% on BigBenchAudio (up from 65.6%) |
| True video streaming | Not announced | Unknown |
| Image generation output | Not announced | Unknown |
| Video output | Not announced | Unknown |

### GPT-5 Integration (August 2025)

GPT-5 released with advanced multimodal capabilities that may eventually integrate with Realtime API:
- Enhanced reasoning
- Longer context windows
- Better vision understanding

---

## 6. Technical Implementation Notes

### WebRTC Connection Setup (GA API)

```javascript
// New GA endpoint
const baseUrl = "https://api.openai.com/v1/realtime/calls";

const fd = new FormData();
fd.set("sdp", peerConnection.localDescription.sdp);
fd.set("session", JSON.stringify(sessionConfig));

const response = await fetch(baseUrl, {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}` },
  body: fd
});
```

### Session Configuration with Multimodal

```javascript
const sessionConfig = {
  model: "gpt-realtime",
  modalities: ["text", "audio"],  // Specify desired output modalities
  instructions: "You are a helpful assistant that can see images...",
  voice: "alloy",
  // ... other config
};
```

### ICE Improvements in GA

- 3 server addresses (was 1 in beta)
- TCP on port 443 for firewall-friendly connections
- Faster negotiation with removed redundant candidates

---

## 7. Current Limitations Summary

| Limitation | Details |
|------------|---------|
| No true video processing | Video converted to snapshots |
| No image generation | Output limited to text/audio |
| No video output | Cannot generate/stream video |
| Image size limits | WebRTC data channel constraints |
| Documentation gaps | Image input not fully documented |
| Vision pricing unclear | Approximately $0.068 per image |

---

## Sources

1. **OpenAI gpt-realtime Announcement** (Aug 28, 2025)
   - https://openai.com/index/introducing-gpt-realtime/

2. **OpenAI Realtime API Documentation**
   - https://platform.openai.com/docs/guides/realtime
   - https://platform.openai.com/docs/api-reference/realtime

3. **webrtcHacks Analysis** (Sep 23, 2025)
   - https://webrtchacks.com/how-openai-does-webrtc-in-the-new-gpt-realtime/

4. **OpenAI Developer Community**
   - https://community.openai.com/t/realtime-model-image-input/1355688

5. **The Decoder - Advanced Voice Mode Updates** (Dec 12, 2024)
   - https://the-decoder.com/openai-adds-live-video-and-screen-sharing-to-advanced-voice-mode/

6. **AGIyes - GPT-Realtime Overview** (Aug 29, 2025)
   - https://www.agiyes.com/ainews/gpt-realtime/

---

## Confidence Level

**High confidence** for core findings - based on official OpenAI announcements, developer community discussions, and technical analysis from WebRTC experts. Pricing details are **medium confidence** as they appear to be approximate based on user testing rather than official documentation.

## Gaps

- Official documentation on image input format is incomplete
- Vision pricing per image is not officially documented
- No official roadmap for true video streaming support
- Unclear if/when image/video output will be supported
- Frame rate processing limits for video-to-image conversion not specified

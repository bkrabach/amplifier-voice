# WebRTC Implementation Details for OpenAI Realtime API

> Research Date: January 2025
> Status: Comprehensive technical analysis

## Research Summary

OpenAI's Realtime API uses a clean, production-ready WebRTC implementation with host-candidates only (no STUN/TURN servers required), Opus codec for audio with PCMU/PCMA fallback, and a data channel named "oai-events" for JSON event exchange. The implementation is browser-compatible across Chrome, Firefox, Edge, and Safari, with iOS requiring special consideration due to H.264-only limitations. Network traversal is handled through multiple Azure endpoints with TCP fallback on port 443 for restrictive firewalls.

---

## 1. ICE/STUN/TURN Configuration

### Key Finding: No STUN/TURN Servers Required

OpenAI's implementation uses **host candidates only** - they do not require you to configure STUN or TURN servers. This is a significant simplification.

#### How It Works

```javascript
// Simple PeerConnection - no ICE servers needed
pc = new RTCPeerConnection();
```

OpenAI provides ICE candidates directly in their SDP answer. As of the GA release, they provide **6 candidates across 3 Azure endpoints**:

```
a=candidate:4152413238 1 udp 2130706431 172.203.39.49 3478 typ host
a=candidate:1788861106 1 tcp 1671430143 172.203.39.49 443 typ host tcptype passive
a=candidate:38269317 1 udp 2130706431 172.214.226.198 3478 typ host
a=candidate:2394539241 1 tcp 1671430143 172.214.226.198 443 typ host tcptype passive
a=candidate:727169150 1 udp 2130706431 4.151.200.38 3478 typ host
a=candidate:1878291698 1 tcp 1671430143 4.151.200.38 443 typ host tcptype passive
```

#### Improvements from Beta to GA

| Field | Beta (Nov 2024) | GA (Sept 2025) |
|-------|-----------------|----------------|
| IPs advertised | 1 | 3 |
| Transports | UDP, TCP | UDP, TCP |
| Ports | 3478 for both | UDP: 3478, TCP: 443 |
| Candidate count | 4 | 6 |
| `end-of-candidates` | Present | Absent (enables trickle ICE) |

#### Why This Matters

- **No TURN server costs** - OpenAI handles relay internally
- **Simpler setup** - No ICE server configuration needed
- **TCP on port 443** - Works through most enterprise firewalls
- **Multiple endpoints** - Better latency and resilience

---

## 2. Data Channels

### Channel Configuration

The data channel is the primary mechanism for sending/receiving JSON events alongside audio streams.

```javascript
// Create data channel with required name
dc = pc.createDataChannel("oai-events");

// Handle incoming messages
dc.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    // Process message based on message.type
});

// Send events
dc.send(JSON.stringify({
    type: "session.update",
    session: { /* configuration */ }
}));
```

### Data Channel Specifications (from SDP)

```
m=application 9 UDP/DTLS/SCTP webrtc-datachannel
a=sctp-port:5000
a=max-message-size:1073741823  // ~1GB max message
```

### Event Types Exchanged

#### Client-to-Server Events
| Event Type | Purpose |
|------------|---------|
| `session.update` | Update session configuration |
| `response.create` | Request AI response |
| `conversation.item.create` | Add user message |
| `input_audio_buffer.clear` | Clear audio buffer |

#### Server-to-Client Events
| Event Type | Purpose |
|------------|---------|
| `session.created` | Session initialized |
| `response.audio_transcript.delta` | Streaming transcript |
| `response.audio_transcript.done` | Complete transcript |
| `conversation.item.input_audio_transcription.completed` | User speech transcript |
| `response.function_call_arguments.done` | Function call completed |
| `input_audio_buffer.speech_started` | VAD detected speech |
| `output_audio_buffer.stopped` | AI finished speaking |

### Message Format

```json
{
    "type": "conversation.item.create",
    "event_id": "unique-id-123",
    "timestamp": "2025-01-31T12:00:00Z",
    "item": {
        "type": "message",
        "role": "user",
        "content": [{ "type": "input_text", "text": "Hello" }]
    }
}
```

---

## 3. Codec Support

### Audio Codecs

OpenAI's WebRTC implementation supports:

| Codec | Format | Priority | Notes |
|-------|--------|----------|-------|
| **Opus** | opus/48000/2 | Primary | Used by browsers, FEC enabled |
| PCMU | PCMU/8000 | Fallback | G.711 mu-law |
| PCMA | PCMA/8000 | Fallback | G.711 A-law |

#### SDP Codec Configuration

```
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1
a=rtcp-fb:111 transport-cc
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
```

#### Important Notes

1. **Don't configure audio formats manually** - The browser uses Opus automatically
2. **`input_audio_format` and `output_audio_format`** in session config are for the internal proxy, not the WebRTC connection
3. **Forward Error Correction (FEC)** is enabled by default (`useinbandfec=1`)
4. **No DTX or RED** - Discontinuous transmission and redundancy not used

### Video Codecs (New in GA)

For video input (LLM vision):

| Codec | Profiles Supported |
|-------|-------------------|
| H.264 | Baseline, Constrained Baseline, Main, High |

**Key insight**: Video isn't truly streamed - it's captured as snapshots when needed. Recommended settings:

```javascript
const videoConstraints = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 1 }  // 1 FPS is sufficient
};
```

---

## 4. Browser Compatibility

### Fully Supported Browsers

| Browser | Status | Notes |
|---------|--------|-------|
| **Chrome** | Excellent | Best debugging tools, full feature support |
| **Edge (Chromium)** | Excellent | Same as Chrome |
| **Firefox** | Good | Strong standards compliance |
| **Safari (macOS)** | Good | H.264 hardware acceleration |
| **Opera** | Good | Chromium-based |

### Codec Support by Browser

| Browser | VP8 | VP9 | H.264 | Opus |
|---------|-----|-----|-------|------|
| Chrome | Yes | Yes | Yes | Yes |
| Firefox | Yes | Partial | Yes | Yes |
| Edge | Yes | Yes | Yes | Yes |
| Safari | Software | No | Hardware | Yes |

### Known Browser Issues

#### Safari
- VP8 is software-decoded (CPU intensive)
- Limited Insertable Streams API support
- May require explicit permission prompts

#### Firefox
- `about:webrtc` for debugging (different from Chrome)
- VP9 only partially supported

#### Cross-Browser
- Use `adapter.js` to normalize SDP negotiation differences
- Test getUserMedia permissions on each browser

---

## 5. Mobile Support

### iOS Considerations

**Critical**: All iOS browsers (Chrome, Firefox, Edge) use WebKit and inherit Safari's limitations.

| Aspect | Support |
|--------|---------|
| WebRTC | Yes (iOS 14.3+) |
| Opus | Yes |
| H.264 | Hardware accelerated |
| VP8/VP9 | Limited/Software only |
| Insertable Streams | No |

#### iOS-Specific Code

```javascript
// Check for iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

// May need explicit audio element interaction
if (isIOS) {
    // Audio elements often need user gesture to play
    document.addEventListener('click', () => {
        audioElement.play().catch(() => {});
    }, { once: true });
}
```

### Android Considerations

| Aspect | Support |
|--------|---------|
| Chrome | Full WebRTC support (like desktop) |
| Firefox | Full WebRTC support |
| WebView | Requires enabling, may have limitations |

#### Android-Specific Notes

- Chrome/Firefox on Android have near-identical functionality to desktop
- Hardware acceleration varies by device
- Battery consumption can be significant for long sessions

### Mobile Best Practices

1. **Test microphone permissions early** - Use Permissions API
2. **Handle audio focus** - Other apps may interrupt
3. **Monitor battery/thermal state** - Long sessions are resource-intensive
4. **Test on real devices** - Emulators don't accurately represent WebRTC performance

---

## 6. Network Requirements

### Port Requirements

| Protocol | Port | Purpose | Required |
|----------|------|---------|----------|
| UDP | 3478 | Primary media transport | Preferred |
| TCP | 443 | Fallback for restrictive networks | Fallback |
| HTTPS | 443 | API calls, signaling | Required |

### Enterprise Network Considerations

#### Firewall Rules Needed

```
# Outbound rules required
Allow UDP to *.azure.com:3478
Allow TCP to *.azure.com:443
Allow HTTPS to api.openai.com:443
```

#### Restrictive Networks (UDP Blocked)

OpenAI's GA implementation includes TCP candidates on port 443:
```
a=candidate:... tcp ... 443 typ host tcptype passive
```

This means WebRTC can fall back to TCP/443 when UDP is blocked, though with higher latency.

### Bandwidth Requirements

| Mode | Minimum | Recommended |
|------|---------|-------------|
| Audio only | 50 kbps | 100 kbps |
| Audio + Video (1 FPS) | 200 kbps | 500 kbps |

### NAT Traversal

OpenAI handles NAT traversal server-side. No STUN/TURN configuration needed on client side. The multiple endpoint IPs help with:
- Geographic routing (lower latency)
- Failover if one endpoint is unreachable
- Load balancing

---

## 7. Connection Diagnostics

### Chrome WebRTC Internals

**URL**: `chrome://webrtc-internals`

Key metrics to monitor:

| Metric | Location | Healthy Value |
|--------|----------|---------------|
| ICE Connection State | Stats | `connected` |
| Packets Lost | Audio Inbound | < 1% |
| Jitter | Audio Inbound | < 30ms |
| Round Trip Time | Transport | < 200ms |

### Debugging Checklist

```javascript
// 1. Monitor connection state
pc.addEventListener("connectionstatechange", () => {
    console.log("Connection state:", pc.connectionState);
    // connected, disconnected, failed, closed
});

// 2. Monitor ICE gathering
pc.addEventListener("icegatheringstatechange", () => {
    console.log("ICE gathering:", pc.iceGatheringState);
});

// 3. Monitor ICE connection
pc.addEventListener("iceconnectionstatechange", () => {
    console.log("ICE connection:", pc.iceConnectionState);
});

// 4. Get stats periodically
setInterval(async () => {
    const stats = await pc.getStats();
    stats.forEach(report => {
        if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            console.log('Packets lost:', report.packetsLost);
            console.log('Jitter:', report.jitter);
        }
    });
}, 5000);
```

### Firefox Debugging

**URL**: `about:webrtc`

Provides similar information with different UI.

### Safari Debugging

**Location**: Web Inspector > Media tab

### Common Issues and Solutions

| Symptom | Likely Cause | Solution |
|---------|--------------|----------|
| No audio | Microphone permission denied | Check permissions API |
| High latency | UDP blocked, using TCP | Check firewall rules |
| Connection timeout | Network blocking WebRTC | Try TCP on 443 |
| Choppy audio | High packet loss | Check network stability |
| No connection | ICE failed | Check webrtc-internals for candidates |

---

## 8. Fallback Strategies

### When WebRTC Fails

OpenAI provides **two connection methods**:

| Method | Protocol | Latency | Use Case |
|--------|----------|---------|----------|
| **WebRTC** | UDP/TCP | ~100-300ms | Browser/mobile clients |
| **WebSocket** | TCP | ~300-500ms+ | Server-side, restricted networks |

### Implementing Fallback

```javascript
async function connectToRealtime() {
    try {
        // Try WebRTC first
        await connectWebRTC();
        console.log("Connected via WebRTC");
    } catch (webrtcError) {
        console.warn("WebRTC failed, trying WebSocket:", webrtcError);
        try {
            // Fall back to WebSocket
            await connectWebSocket();
            console.log("Connected via WebSocket");
        } catch (wsError) {
            console.error("All connections failed");
            throw wsError;
        }
    }
}
```

### WebSocket Fallback Implementation

```javascript
async function connectWebSocket() {
    // Get ephemeral token from your server
    const token = await getEphemeralToken();
    
    const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview`,
        ["realtime", `openai-insecure-api-key.${token}`, "openai-beta.realtime-v1"]
    );
    
    // Handle audio manually (more complex than WebRTC)
    // - Encode microphone audio to base64
    // - Send via input_audio_buffer.append
    // - Decode received audio from base64
}
```

### WebRTC vs WebSocket Comparison

| Aspect | WebRTC | WebSocket |
|--------|--------|-----------|
| Protocol | UDP (preferred) | TCP only |
| Latency | Lower (~100-300ms) | Higher (~300-500ms+) |
| Packet loss handling | Graceful (skips) | Retransmits (causes lag) |
| Client complexity | Lower (browser handles audio) | Higher (manual audio encoding) |
| Network requirements | More permissive needed | Works anywhere HTTPS works |
| Recommended for | Browser/mobile apps | Server-side applications |

### Detecting WebRTC Support

```javascript
function isWebRTCSupported() {
    return !!(
        window.RTCPeerConnection &&
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
    );
}

function canUseWebRTC() {
    // Check basic support
    if (!isWebRTCSupported()) return false;
    
    // Check if in secure context (required for getUserMedia)
    if (!window.isSecureContext) return false;
    
    return true;
}
```

---

## Implementation Recommendations

### Production Checklist

- [ ] Test on all target browsers (Chrome, Firefox, Safari, Edge)
- [ ] Test on iOS devices (Safari WebKit limitations)
- [ ] Test on Android devices (Chrome, Firefox)
- [ ] Test on restrictive networks (corporate firewalls)
- [ ] Implement connection state monitoring
- [ ] Implement reconnection logic
- [ ] Consider WebSocket fallback for critical applications
- [ ] Monitor latency and packet loss in production
- [ ] Handle microphone permission errors gracefully
- [ ] Test with various network conditions (3G, 4G, WiFi)

### Minimal Working Example

```javascript
async function startRealtimeSession(apiKey, model = "gpt-4o-realtime-preview") {
    // 1. Get microphone
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const [track] = stream.getAudioTracks();
    
    // 2. Create peer connection
    const pc = new RTCPeerConnection();
    
    // 3. Handle remote audio
    const audioEl = document.createElement("audio");
    audioEl.autoplay = true;
    pc.ontrack = (e) => audioEl.srcObject = e.streams[0];
    
    // 4. Add local audio
    pc.addTrack(track, stream);
    
    // 5. Create data channel
    const dc = pc.createDataChannel("oai-events");
    
    // 6. Create and send offer
    await pc.setLocalDescription();
    
    const response = await fetch(
        `https://api.openai.com/v1/realtime/calls`,
        {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: new URLSearchParams({
                sdp: pc.localDescription.sdp,
                model: model
            })
        }
    );
    
    const answer = await response.json();
    await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });
    
    // 7. Wait for connection
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject("Connection timeout"), 10000);
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "connected") {
                clearTimeout(timeout);
                resolve();
            }
        };
    });
    
    return { pc, dc, track };
}
```

---

## Sources

1. [OpenAI Realtime API WebRTC Documentation](https://platform.openai.com/docs/guides/realtime-webrtc)
2. [webrtcHacks: Unofficial Guide to OpenAI Realtime WebRTC API](https://webrtchacks.com/the-unofficial-guide-to-openai-realtime-webrtc-api/)
3. [webrtcHacks: How OpenAI does WebRTC in gpt-realtime](https://webrtchacks.com/how-openai-does-webrtc-in-the-new-gpt-realtime/)
4. [DeepWiki: Data Channel Setup](https://deepwiki.com/openai/openai-realtime-console/4.1-data-channel-setup)
5. [Ant Media: WebRTC Browser Support 2025](https://new.antmedia.io/webrtc-browser-support/)
6. [eesel.ai: Realtime API vs WebRTC Guide](https://www.eesel.ai/blog/realtime-api-vs-webrtc)

---

## Confidence Level

**High confidence** on:
- ICE/STUN/TURN configuration (direct from SDP analysis)
- Data channel implementation (verified in multiple sources)
- Audio codec support (from SDP)
- Browser compatibility (industry standard knowledge)

**Medium confidence** on:
- Video implementation details (newer feature, less documentation)
- Exact latency numbers (network-dependent)
- Enterprise firewall behavior (varies by configuration)

**Information that may change**:
- OpenAI endpoint IPs and ports
- GA API endpoint paths
- Pricing for video/vision features

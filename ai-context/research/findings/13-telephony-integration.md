# Telephony Integration with OpenAI Realtime API

## Research Summary

Integrating telephony with OpenAI's Realtime API involves connecting phone calls (PSTN/SIP) to the WebSocket-based Realtime API. Twilio is the most common integration path, using Media Streams to bridge audio between telephone networks and OpenAI. Key challenges include audio format conversion (G.711 vs PCM16), session limits (15 minutes), and implementing call control features like transfers and DTMF handling.

---

## 1. Twilio Integration Architecture

### Core Architecture Pattern

The fundamental integration follows this flow:

```
[Phone/PSTN] <-> [Twilio] <-> [Your Server (WebSocket)] <-> [OpenAI Realtime API]
```

**How it works:**
1. Twilio receives an incoming call and triggers a webhook
2. Your server responds with TwiML containing `<Connect><Stream>` to open a Media Stream
3. Twilio opens a WebSocket connection to your server
4. Your server proxies audio bidirectionally between Twilio and OpenAI's Realtime API
5. Audio flows in real-time: Twilio -> Your Server -> OpenAI -> Your Server -> Twilio

### Integration Options

| Approach | Description | Complexity | Latency |
|----------|-------------|------------|---------|
| **Media Streams** | WebSocket-based audio proxy through your server | Medium | Higher |
| **Direct SIP** | OpenAI's native SIP connector (newer) | Lower | Lower |
| **ConversationRelay** | Twilio's managed solution (Public Beta) | Lowest | Medium |
| **Elastic SIP Trunking** | Direct SIP connection via Twilio trunking | Medium | Lower |

### Media Streams Approach (Most Common)

```javascript
// TwiML Response for incoming call
app.post('/incoming-call', (req, res) => {
  const twiml = `
    <Response>
      <Connect>
        <Stream url="wss://your-server.com/media-stream" />
      </Connect>
    </Response>
  `;
  res.type('text/xml').send(twiml);
});

// WebSocket handler
app.ws('/media-stream', (ws, req) => {
  // Create connection to OpenAI Realtime API
  const openaiWs = new WebSocket('wss://api.openai.com/v1/realtime', {
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
  });
  
  // Proxy audio bidirectionally
  ws.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.event === 'media') {
      // Convert and forward to OpenAI
      const audio = convertMulawToPcm16(data.media.payload);
      openaiWs.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: audio
      }));
    }
  });
  
  openaiWs.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.type === 'response.audio.delta') {
      // Convert and send back to Twilio
      const mulaw = convertPcm16ToMulaw(data.delta);
      ws.send(JSON.stringify({
        event: 'media',
        streamSid: streamSid,
        media: { payload: mulaw }
      }));
    }
  });
});
```

### OpenAI Direct SIP Connector (Newer Option)

OpenAI now offers a native SIP endpoint that can receive calls directly:

**Benefits:**
- No middleware server required for basic use cases
- Lower latency (no double hop)
- Native G.711 support

**Setup with Twilio Elastic SIP Trunking:**
1. Configure Twilio Elastic SIP Trunk
2. Point termination URI to OpenAI's SIP endpoint
3. Configure authentication via SIP headers
4. Route phone numbers to the trunk

```
sip:realtime@api.openai.com
```

**Limitations:**
- Less control over call flow
- Function calling requires callback URLs
- Session management is more limited

---

## 2. SIP/PSTN Phone Number Provisioning

### Twilio Phone Numbers

**Types Available:**
- **Local Numbers**: Geographic numbers for specific regions
- **Toll-Free**: 800/888/877 numbers (US)
- **Mobile**: SMS-capable numbers
- **Short Codes**: 5-6 digit numbers for high volume

**Provisioning via API:**
```javascript
const client = require('twilio')(accountSid, authToken);

// Purchase a number
const number = await client.incomingPhoneNumbers.create({
  phoneNumber: '+15551234567',
  voiceUrl: 'https://your-server.com/incoming-call',
  voiceMethod: 'POST'
});
```

### SIP Trunk Configuration

For enterprise deployments or existing PBX systems:

```javascript
// Create SIP Trunk
const trunk = await client.trunking.v1.trunks.create({
  friendlyName: 'OpenAI Voice AI Trunk'
});

// Add Termination URI
await client.trunking.v1.trunks(trunk.sid)
  .terminationUris.create({
    sipUrl: 'sip:your-server.com:5060',
    weight: 1,
    priority: 1
  });

// Associate phone number
await client.trunking.v1.trunks(trunk.sid)
  .phoneNumbers.create({
    phoneNumberSid: 'PN...'
  });
```

### Inbound vs Outbound Calls

**Inbound Calls:**
1. Configure webhook URL on phone number
2. Receive call metadata (From, To, CallSid)
3. Return TwiML to connect Media Stream
4. Handle call in WebSocket

**Outbound Calls:**
```javascript
// Initiate outbound call
const call = await client.calls.create({
  url: 'https://your-server.com/outbound-twiml',
  to: '+15551234567',
  from: '+15559876543'
});

// TwiML for outbound (same as inbound)
app.post('/outbound-twiml', (req, res) => {
  res.type('text/xml').send(`
    <Response>
      <Connect>
        <Stream url="wss://your-server.com/media-stream" />
      </Connect>
    </Response>
  `);
});
```

---

## 3. Audio Format Conversion

### Format Specifications

| Format | Bits | Sample Rate | Use Case |
|--------|------|-------------|----------|
| **G.711 u-law (mulaw)** | 8-bit | 8 kHz | Telephony standard (Twilio) |
| **G.711 a-law** | 8-bit | 8 kHz | European telephony |
| **PCM16** | 16-bit | 24 kHz | OpenAI Realtime API native |

### Conversion Requirements

**Twilio Media Streams sends/receives:**
- Format: `audio/x-mulaw`
- Sample rate: 8000 Hz
- Encoding: Base64

**OpenAI Realtime API accepts:**
- `pcm16` (16-bit PCM, 24 kHz) - **Best quality**
- `g711_ulaw` (8 kHz) - **Telephony compatible**
- `g711_alaw` (8 kHz) - **Telephony compatible**

### Native G.711 Support (Recommended)

OpenAI now supports G.711 natively, eliminating conversion overhead:

```javascript
// Configure session for G.711
openaiWs.send(JSON.stringify({
  type: 'session.update',
  session: {
    input_audio_format: 'g711_ulaw',
    output_audio_format: 'g711_ulaw'
  }
}));
```

**Trade-off:** Voice quality is lower with G.711 compared to PCM16 due to:
- Lower sample rate (8 kHz vs 24 kHz)
- Lossy compression
- Limited frequency range (300 Hz - 8 kHz)

### PCM16 Conversion (Higher Quality)

If using PCM16 for better quality, conversion is required:

```javascript
const { MuLawDecoder, MuLawEncoder } = require('alawmulaw');

// Twilio (mulaw 8kHz) -> OpenAI (pcm16 24kHz)
function mulawToPcm16(mulawBase64) {
  const mulaw = Buffer.from(mulawBase64, 'base64');
  
  // Decode mulaw to PCM16 (8kHz)
  const pcm8k = MuLawDecoder.decode(mulaw);
  
  // Upsample 8kHz -> 24kHz (3x)
  const pcm24k = upsample(pcm8k, 3);
  
  return Buffer.from(pcm24k).toString('base64');
}

// OpenAI (pcm16 24kHz) -> Twilio (mulaw 8kHz)
function pcm16ToMulaw(pcm16Base64) {
  const pcm24k = Buffer.from(pcm16Base64, 'base64');
  
  // Downsample 24kHz -> 8kHz (take every 3rd sample)
  const pcm8k = downsample(pcm24k, 3);
  
  // Encode to mulaw
  const mulaw = MuLawEncoder.encode(pcm8k);
  
  return Buffer.from(mulaw).toString('base64');
}

// Simple downsampling (production should use proper anti-aliasing)
function downsample(buffer, factor) {
  const samples = new Int16Array(buffer.buffer);
  const output = new Int16Array(Math.floor(samples.length / factor));
  for (let i = 0; i < output.length; i++) {
    output[i] = samples[i * factor];
  }
  return Buffer.from(output.buffer);
}
```

### Audio Quality Considerations

| Approach | Quality | Latency | Complexity |
|----------|---------|---------|------------|
| Native G.711 | Lower (telephony grade) | Lowest | Simplest |
| PCM16 with conversion | Higher | Higher | More complex |
| Hybrid (record in PCM16) | Best of both | Medium | Most complex |

---

## 4. Call Flow Patterns

### Inbound Call Flow

```
1. Caller dials your Twilio number
2. Twilio sends webhook to your server
3. Server returns TwiML with <Connect><Stream>
4. Twilio opens WebSocket to your server
5. Server opens WebSocket to OpenAI Realtime API
6. Bidirectional audio streaming begins
7. OpenAI processes speech and responds
8. Conversation continues until hangup
9. Twilio sends status callback
```

### Outbound Call Flow

```
1. Your application initiates call via Twilio API
2. Twilio dials the recipient
3. When answered, Twilio requests TwiML
4. Same Media Stream flow as inbound
5. AI agent speaks first (greeting)
6. Conversation proceeds
7. Either party can hang up
```

### Call State Management

```javascript
// Track call state
const activeCalls = new Map();

app.ws('/media-stream', (ws, req) => {
  let callState = {
    callSid: null,
    streamSid: null,
    openaiWs: null,
    startTime: Date.now(),
    transcripts: []
  };
  
  ws.on('message', (msg) => {
    const data = JSON.parse(msg);
    
    switch (data.event) {
      case 'start':
        callState.callSid = data.start.callSid;
        callState.streamSid = data.start.streamSid;
        activeCalls.set(callState.callSid, callState);
        // Initialize OpenAI connection
        break;
        
      case 'media':
        // Process audio
        break;
        
      case 'stop':
        // Clean up
        activeCalls.delete(callState.callSid);
        callState.openaiWs?.close();
        break;
    }
  });
});
```

### Handling Interruptions

OpenAI's VAD (Voice Activity Detection) handles interruptions:

```javascript
// When user interrupts AI speech
openaiWs.on('message', (msg) => {
  const data = JSON.parse(msg);
  
  if (data.type === 'input_audio_buffer.speech_started') {
    // Clear Twilio's audio buffer
    twilioWs.send(JSON.stringify({
      event: 'clear',
      streamSid: streamSid
    }));
  }
});
```

---

## 5. DTMF Handling

### Twilio Media Streams DTMF Support

Twilio Media Streams now supports DTMF (Generally Available):

```javascript
// Enable DTMF in TwiML
const twiml = `
<Response>
  <Connect>
    <Stream url="wss://your-server.com/media-stream">
      <Parameter name="dtmfDetection" value="true" />
    </Stream>
  </Connect>
</Response>
`;

// Handle DTMF events in WebSocket
ws.on('message', (msg) => {
  const data = JSON.parse(msg);
  
  if (data.event === 'dtmf') {
    const digit = data.dtmf.digit;  // '0'-'9', '*', '#'
    console.log(`DTMF digit received: ${digit}`);
    
    // Inject into conversation context
    openaiWs.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{
          type: 'input_text',
          text: `[User pressed ${digit} on phone keypad]`
        }]
      }
    }));
  }
});
```

### Sending DTMF Tones

```javascript
// Generate and send DTMF tones to caller
function sendDtmf(digit) {
  // DTMF frequencies (Hz)
  const dtmfFreqs = {
    '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
    '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
    '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
    '*': [941, 1209], '0': [941, 1336], '#': [941, 1477]
  };
  
  // Generate tone and send via media message
  // Or use Twilio's <Play digits="123"> TwiML
}
```

### Alternative: TwiML Gather

For structured DTMF collection, exit Media Stream temporarily:

```xml
<Response>
  <Gather numDigits="4" action="/process-pin" method="POST">
    <Say>Please enter your 4-digit PIN</Say>
  </Gather>
  <Connect>
    <Stream url="wss://your-server.com/media-stream" />
  </Connect>
</Response>
```

---

## 6. Call Recording

### Technical Implementation

**Twilio Recording Options:**

```javascript
// Enable recording on call
const call = await client.calls.create({
  url: 'https://your-server.com/twiml',
  to: '+15551234567',
  from: '+15559876543',
  record: true,
  recordingChannels: 'dual',  // Separate channels for each party
  recordingStatusCallback: 'https://your-server.com/recording-status'
});

// Or via TwiML
const twiml = `
<Response>
  <Record 
    recordingChannels="dual"
    recordingStatusCallback="/recording-status"
  />
  <Connect>
    <Stream url="wss://your-server.com/media-stream" />
  </Connect>
</Response>
`;
```

**Dual-Channel Recording Benefits:**
- Separate audio tracks for caller and AI
- Better transcription accuracy
- Easier compliance review
- Speaker diarization built-in

### Server-Side Recording

You can also record at your server level:

```javascript
const fs = require('fs');
const WavEncoder = require('wav').FileWriter;

ws.on('message', (msg) => {
  const data = JSON.parse(msg);
  if (data.event === 'media') {
    // Write to file
    recordingStream.write(Buffer.from(data.media.payload, 'base64'));
  }
});
```

### Legal Compliance Requirements

| Jurisdiction | Requirement |
|--------------|-------------|
| **One-Party Consent States (US)** | One party must know about recording |
| **Two-Party/All-Party States** | All parties must consent (CA, FL, IL, etc.) |
| **GDPR (EU)** | Explicit consent, data protection requirements |
| **TCPA (US)** | Restrictions on automated calls |
| **HIPAA** | Healthcare data protection requirements |
| **PCI-DSS** | Payment card data must not be recorded |

### Compliance Best Practices

```javascript
// Announce recording at start of call
const twiml = `
<Response>
  <Say>This call may be recorded for quality assurance purposes.</Say>
  <Pause length="1"/>
  <Connect>
    <Stream url="wss://your-server.com/media-stream" />
  </Connect>
</Response>
`;

// In OpenAI system prompt
const systemPrompt = `
You are a voice assistant. At the start of each call, inform the caller:
"This call is being recorded for quality purposes. Do you consent to continue?"
Wait for affirmative response before proceeding.
If they say no, thank them and end the call.
`;
```

### TCPA Compliance for AI Calls

The FCC confirmed (Feb 2024) that TCPA applies to AI-generated voices:

**Requirements:**
- Prior express consent required for automated calls
- Written consent for marketing calls
- Honor do-not-call lists
- Provide opt-out mechanisms
- Disclose AI nature when required by state law

```javascript
// Check consent before calling
async function initiateCall(phoneNumber) {
  const consent = await checkConsentDatabase(phoneNumber);
  if (!consent.hasConsent) {
    throw new Error('No consent on file');
  }
  if (consent.onDoNotCallList) {
    throw new Error('Number on DNC list');
  }
  // Proceed with call
}
```

---

## 7. Call Transfer and Hold

### Warm Transfer Implementation

Transfer caller to human agent while AI provides context:

```javascript
// Function tool for transfer
const tools = [{
  type: 'function',
  name: 'transfer_to_human',
  description: 'Transfer the call to a human agent',
  parameters: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'Reason for transfer' },
      department: { type: 'string', enum: ['sales', 'support', 'billing'] }
    }
  }
}];

// Handle transfer request
async function handleTransfer(callSid, department, context) {
  // Use Twilio's Conference for warm transfer
  const conference = `transfer-${callSid}`;
  
  // Move caller to conference (on hold with music)
  await client.calls(callSid).update({
    twiml: `
      <Response>
        <Dial>
          <Conference waitUrl="/hold-music" startConferenceOnEnter="false">
            ${conference}
          </Conference>
        </Dial>
      </Response>
    `
  });
  
  // Call human agent
  await client.calls.create({
    url: `/agent-join?conference=${conference}&context=${encodeURIComponent(context)}`,
    to: getAgentNumber(department),
    from: '+15559876543'
  });
}
```

### Cold Transfer (SIP REFER)

Direct transfer without keeping original connection:

```javascript
// Using Twilio's <Dial> for cold transfer
const coldTransferTwiml = `
<Response>
  <Dial>+15551234567</Dial>
</Response>
`;

// Or via API
await client.calls(callSid).update({
  twiml: coldTransferTwiml
});
```

### Hold Functionality

```javascript
// Put caller on hold
async function holdCall(callSid) {
  await client.calls(callSid).update({
    twiml: `
      <Response>
        <Play loop="0">https://your-server.com/hold-music.mp3</Play>
      </Response>
    `
  });
}

// Resume from hold
async function resumeCall(callSid) {
  await client.calls(callSid).update({
    twiml: `
      <Response>
        <Connect>
          <Stream url="wss://your-server.com/media-stream" />
        </Connect>
      </Response>
    `
  });
}
```

### Conference-Based Architecture

For complex call control, use conferences:

```javascript
// Three-way call setup
const twiml = `
<Response>
  <Dial>
    <Conference 
      beep="false"
      startConferenceOnEnter="true"
      endConferenceOnExit="false"
      waitUrl="/hold-music">
      call-${callSid}
    </Conference>
  </Dial>
</Response>
`;
```

---

## 8. Scale Considerations

### OpenAI Realtime API Limits

| Limit | Value | Notes |
|-------|-------|-------|
| **Session Duration** | 15 minutes max | Hard limit, must reconnect |
| **Context Length** | 128,000 tokens | ~2.6 hours of audio |
| **Audio Token Rate** | ~800 tokens/minute | Of actual speech |
| **Concurrent Sessions** | Varies by tier | Contact OpenAI for enterprise |

### Session Management for Long Calls

```javascript
// Handle 15-minute session limit
class CallSession {
  constructor(callSid) {
    this.callSid = callSid;
    this.sessionStart = Date.now();
    this.conversationHistory = [];
    this.sessionTimeout = null;
  }
  
  startSessionTimer() {
    // Warn at 14 minutes, reconnect before 15
    this.sessionTimeout = setTimeout(() => {
      this.reconnectSession();
    }, 14 * 60 * 1000);
  }
  
  async reconnectSession() {
    // Save current context
    const context = this.getConversationSummary();
    
    // Close old OpenAI connection
    this.openaiWs.close();
    
    // Create new session with context
    this.openaiWs = new WebSocket(OPENAI_REALTIME_URL);
    await this.initializeWithContext(context);
    
    // Reset timer
    this.startSessionTimer();
  }
  
  getConversationSummary() {
    // Summarize conversation for new session
    return this.conversationHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
  }
}
```

### Infrastructure Architecture

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
    │ Server 1│        │ Server 2│        │ Server N│
    │(WS Hub) │        │(WS Hub) │        │(WS Hub) │
    └────┬────┘        └────┬────┘        └────┬────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Redis/State    │
                    │   Management    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ OpenAI Realtime │
                    │      API        │
                    └─────────────────┘
```

### Scaling Strategies

**1. Horizontal Scaling:**
```javascript
// Use sticky sessions for WebSocket connections
// Each server handles N concurrent calls
// Redis for shared state

const redis = require('redis');
const client = redis.createClient();

// Store call state
await client.hSet(`call:${callSid}`, {
  serverId: process.env.SERVER_ID,
  startTime: Date.now(),
  status: 'active'
});
```

**2. Connection Pooling:**
```javascript
// Reuse WebSocket connections where possible
class OpenAIConnectionPool {
  constructor(maxConnections) {
    this.pool = [];
    this.maxConnections = maxConnections;
  }
  
  async getConnection() {
    // Return available connection or create new
  }
  
  releaseConnection(conn) {
    // Return to pool for reuse
  }
}
```

**3. Rate Limiting:**
```javascript
const rateLimit = require('express-rate-limit');

// Limit concurrent calls per account
const callLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,  // 100 calls per minute
  keyGenerator: (req) => req.body.AccountSid
});
```

### Cost Optimization

**OpenAI Realtime API Pricing (Approximate):**
- 1 minute call: ~$0.11
- 5 minute call: ~$0.92
- 10 minute call: ~$2.68
- 15 minute call: ~$5.28

**Cost Reduction Strategies:**
1. Use text context instead of audio for history
2. Implement conversation summarization
3. Use silence detection to reduce token usage
4. Consider hybrid STT/TTS for cost-sensitive applications

```javascript
// Convert audio history to text to reduce costs
async function optimizeContext(conversationHistory) {
  // Replace audio messages with transcriptions
  return conversationHistory.map(msg => ({
    role: msg.role,
    content: msg.transcript || msg.content
  }));
}
```

### Monitoring and Observability

```javascript
// Track key metrics
const metrics = {
  activeCalls: new Gauge('active_calls'),
  callDuration: new Histogram('call_duration_seconds'),
  apiLatency: new Histogram('openai_latency_ms'),
  errorRate: new Counter('call_errors_total')
};

// Log call events
function logCallEvent(callSid, event, data) {
  logger.info({
    callSid,
    event,
    timestamp: Date.now(),
    ...data
  });
}
```

---

## Quick Reference: Integration Checklist

### Minimum Viable Integration
- [ ] Twilio account with phone number
- [ ] OpenAI API key with Realtime API access
- [ ] WebSocket server (Node.js, Python, etc.)
- [ ] Audio format handling (G.711 native or conversion)
- [ ] Basic error handling

### Production Readiness
- [ ] Session management (15-min limit handling)
- [ ] Call recording with compliance notices
- [ ] DTMF handling
- [ ] Transfer capabilities
- [ ] Horizontal scaling architecture
- [ ] Monitoring and alerting
- [ ] Cost tracking
- [ ] Consent management
- [ ] Error recovery and retry logic

---

## Sources

1. Twilio Blog: "A Minimalist Integration of Twilio and OpenAI Realtime" - https://www.twilio.com/en-us/blog/minimalist-integration-twilio-openai-realtime
2. Twilio Blog: "Build an AI Voice Assistant with Twilio Voice, OpenAI's Realtime API, and Node.js" - https://www.twilio.com/en-us/blog/voice-ai-assistant-openai-realtime-api-node
3. Latent Space: "OpenAI Realtime API: The Missing Manual" - https://www.latent.space/p/realtime-api
4. OpenAI Platform: "Realtime API with SIP" - https://platform.openai.com/docs/guides/realtime-sip
5. Twilio Docs: "Media Streams WebSocket Messages" - https://www.twilio.com/docs/voice/media-streams/websocket-messages
6. Twilio Blog: "Make Outbound calls with Python, the OpenAI Realtime API" - https://www.twilio.com/en-us/blog/outbound-calls-python-openai-realtime-api-voice
7. Twilio Blog: "Warm Transfer to Human Agent from OpenAI Realtime API" - https://www.twilio.com/en-us/blog/developers/tutorials/product/warm-transfer-openai-realtime-programmable-sip
8. Twilio Changelog: "Media Streams DTMF Support GA" - https://www.twilio.com/en-us/changelog/twilio-media-streams--connect--stream--dtmf-support-now-generall
9. Evil Martians: "AnyCable + Twilio-OpenAI Connection" - https://evilmartians.com/chronicles/anycable-speaking-needing-help-with-a-twilio-openai-connection
10. FCC: "TCPA Applies to AI Technologies" - https://www.fcc.gov/document/fcc-confirms-tcpa-applies-ai-technologies-generate-human-voices
11. GitHub: "OpenAI Realtime Twilio Integration" - https://github.com/robinske/openai-realtime-twilio
12. OpenAI Community: "Managing Longer Than 30min Sessions" - https://community.openai.com/t/realtime-api-hows-everyone-managing-longer-than-30min-sessions/1144295

---

## Confidence Level

**High confidence** on:
- Twilio Media Streams integration patterns
- Audio format specifications and conversion
- Basic call flow patterns
- DTMF support (now GA)

**Medium confidence** on:
- OpenAI Direct SIP connector (newer, less documentation)
- Exact rate limits (varies by tier)
- Cost projections (prices may have changed)

**Information gaps**:
- Detailed OpenAI SIP endpoint configuration
- Enterprise-specific rate limits
- ConversationRelay full documentation (still in beta)

---

*Research compiled: January 2026*

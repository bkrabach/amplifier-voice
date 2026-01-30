# Amplifier Voice Client

React-based web client for real-time voice conversations with OpenAI's `gpt-realtime` model and Amplifier tool execution.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Browser                                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │  User Interface (React + Fluent UI)              │  │
│  │  - Start/Stop controls                           │  │
│  │  - Transcript display                            │  │
│  │  - Tool execution status                         │  │
│  └──────────────────────────────────────────────────┘  │
│                      ↕ (WebRTC)                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  WebRTC Connection                                │  │
│  │  - Audio track (microphone)                      │  │
│  │  - Audio track (speaker) ← OpenAI                │  │
│  │  - Data channel (events) ↔ OpenAI                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│  Voice Server (FastAPI)                                 │
│  - Session creation (ephemeral keys)                    │
│  - SDP exchange (WebRTC signaling)                      │
│  - Tool execution via Amplifier                         │
└─────────────────────────────────────────────────────────┘
```

## Features

### Real-Time Voice
- **WebRTC audio** for low-latency voice I/O
- **Voice Activity Detection (VAD)** on server side
- **Automatic transcription** of user speech
- **Streamed audio responses** from assistant

### OpenAI Realtime API (GA)
- Uses `gpt-realtime` model (General Availability)
- Ephemeral API keys for secure client connections
- Full duplex audio streaming
- Function calling support

### Tool Execution via Amplifier
- **13+ tools** available (bash, filesystem, web, etc.)
- **Server-side execution** for security
- **Real-time status updates** in UI
- **Automatic retry** on errors

### User Interface
- **Fluent UI** components for professional look
- **Live transcript** with streaming updates
- **Tool status indicators** (executing/completed/error)
- **Simple controls** (start/stop)

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/brkrabac/repos/realtime-voice/amplifier-voice/voice-client

# Using npm
npm install

# Or using pnpm
pnpm install
```

### 2. Start Development Server

```bash
npm run dev
# or
pnpm dev
```

The client will be available at http://localhost:5173

### 3. Start Voice Server

In another terminal:

```bash
cd ../voice-server
.venv/bin/python -m voice_server.start
```

The server should be running at http://localhost:8080

### 4. Use the App

1. Open http://localhost:5173 in your browser
2. Click "Start Voice Chat"
3. Allow microphone access when prompted
4. Start speaking!

## Project Structure

```
voice-client/
├── src/
│   ├── components/           # React components
│   │   ├── VoiceChat.tsx     # Main container
│   │   ├── ControlsPanel.tsx # Start/stop controls
│   │   └── TranscriptDisplay.tsx  # Message display
│   │
│   ├── hooks/                # React hooks
│   │   ├── useVoiceChat.ts   # Main orchestration
│   │   ├── useWebRTC.ts      # WebRTC connection
│   │   └── useChatMessages.ts # Message state & tool execution
│   │
│   ├── models/               # TypeScript types
│   │   ├── VoiceChatEvent.ts # Event types
│   │   ├── Message.ts        # Message types
│   │   └── ToolCall.ts       # Tool call types
│   │
│   ├── utils/                # Utilities
│   │   └── transcriptParser.ts # Parse event streams
│   │
│   ├── App.tsx               # App root
│   └── main.tsx              # Entry point
│
├── package.json
├── vite.config.ts
└── README.md (this file)
```

## How It Works

### 1. Connection Flow

```
User clicks "Start" 
  → Request microphone access
  → Create RTCPeerConnection
  → Add microphone track
  → Create data channel
  → Generate SDP offer
  → POST /session (get ephemeral key)
  → POST /sdp (exchange SDP)
  → Set remote description
  → Connection established!
```

### 2. Voice Conversation Flow

```
User speaks
  → Browser captures audio
  → Sent to OpenAI via WebRTC
  → OpenAI VAD detects speech
  → OpenAI transcribes
  → event: input_audio_buffer.speech_started
  → event: conversation.item.input_audio_transcription.completed
  
OpenAI responds
  → event: response.output_text.delta (streaming)
  → event: response.output_text.done
  → Audio streamed to browser
  → User hears response
```

### 3. Tool Execution Flow

```
OpenAI decides to use a tool
  → event: response.function_call_arguments.delta
  → event: response.function_call_arguments.done
  
Client executes tool
  → POST /execute/{tool_name}
  → Amplifier executes on server
  → Result returned
  
Client sends result back
  → event: conversation.item.create (function_call_output)
  → event: response.create (trigger assistant response)
  
OpenAI speaks the result
  → Audio response with tool result
```

## OpenAI Realtime Events (GA API)

The client handles these event types:

### User Events
- `input_audio_buffer.speech_started` - User started speaking
- `input_audio_buffer.speech_stopped` - User stopped speaking
- `conversation.item.input_audio_transcription.completed` - User's speech transcribed

### Assistant Events
- `response.output_text.delta` - Streamed text response (GA API change)
- `response.output_text.done` - Complete text response (GA API change)

### Tool/Function Events
- `response.function_call_arguments.delta` - Streaming function args
- `response.function_call_arguments.done` - Complete function call

### Note: GA API Changes
The General Availability API uses different event names than the beta:
- `response.audio_transcript.*` → `response.output_text.*`
- `response.audio.*` → `response.output_audio.*`

## Configuration

### Server URL

Change the server URL in both files if needed:

**src/hooks/useWebRTC.ts:**
```typescript
const BASE_URL = 'http://127.0.0.1:8080';
```

**src/hooks/useChatMessages.ts:**
```typescript
const BASE_URL = 'http://127.0.0.1:8080';
```

### WebRTC Settings

Adjust audio constraints in **src/hooks/useWebRTC.ts:**

```typescript
const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
        echoCancellation: true,  // Reduce echo
        noiseSuppression: true,  // Reduce background noise
        autoGainControl: true    // Normalize volume
    }
});
```

## Available Scripts

```bash
# Development server with hot reload
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build

# Preview production build
npm run preview

# Linting
npm run lint
```

## Dependencies

### Core
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool

### UI
- **@fluentui/react-components** - Microsoft Fluent UI
- **@fluentui/react-icons** - Icon set

### Build/Dev
- **@vitejs/plugin-react** - React support for Vite
- **ESLint** - Code quality

## Browser Compatibility

Requires a modern browser with:
- WebRTC support (RTCPeerConnection, MediaStream)
- getUserMedia API (microphone access)
- ES2020+ JavaScript support

Tested on:
- Chrome 100+
- Firefox 100+
- Safari 15.4+
- Edge 100+

## Troubleshooting

### "Permission denied" for microphone

Grant microphone permissions in browser settings.

**Chrome:** chrome://settings/content/microphone
**Firefox:** about:preferences#privacy → Permissions → Microphone
**Safari:** Safari → Settings → Websites → Microphone

### "Connection failed"

1. Check that voice server is running: http://localhost:8080/health
2. Check server logs for errors
3. Verify OpenAI API key is set in server `.env`

### No audio output

1. Check browser audio settings
2. Try a different browser
3. Check system audio output device
4. Look for errors in browser console

### Events not being received

1. Open browser dev tools → Console
2. Look for WebSocket/data channel errors
3. Check server logs for event processing
4. Verify network tab shows successful /session and /sdp requests

### Tool execution fails

1. Check server logs for Amplifier errors
2. Verify Amplifier bundle is loaded (check server startup)
3. Test tool execution directly: `curl -X POST http://localhost:8080/execute/bash -d '{"arguments":{"command":"echo test"}}'`

## Development Tips

### Testing Without Voice

You can test the UI by sending events manually via the data channel:

```javascript
// In browser console after connecting
const event = {
    type: 'conversation.item.input_audio_transcription.completed',
    transcript: 'Hello, world!',
    timestamp: Date.now()
};
// Send via data channel reference (need to expose it first)
```

### Debugging Events

Add logging to **src/hooks/useChatMessages.ts:**

```typescript
const handleEvent = useCallback(async (event: VoiceChatEvent, rtcDataChannel?: RTCDataChannel) => {
    console.log('Event received:', event.type, event); // Add this
    // ... rest of handler
}, [executeToolCall]);
```

### Monitoring WebRTC Connection

```javascript
// In browser console
const pc = // get peer connection reference
pc.getStats().then(stats => {
    stats.forEach(report => {
        console.log(report.type, report);
    });
});
```

## Next Steps

- [ ] Add reconnection logic for dropped connections
- [ ] Implement push-to-talk mode
- [ ] Add conversation history persistence
- [ ] Add user settings (voice selection, speed, etc.)
- [ ] Add authentication/authorization
- [ ] Add metrics and analytics
- [ ] Deploy to production

## Resources

- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Fluent UI React](https://react.fluentui.dev/)
- [Voice Server README](../voice-server/README.md)

## License

See parent project for license information.

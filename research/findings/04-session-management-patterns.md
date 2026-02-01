# Session Management and Connection Handling for OpenAI Realtime Voice API

## Research Summary

OpenAI's Realtime API sessions have hard limits (30 minutes for Azure, 60 minutes for OpenAI), with no built-in reconnection or session resume capability. Ephemeral tokens are used for client-side authentication with ~5-10 minute effective validity, though `expires_at` may show longer periods. Session state must be manually preserved and restored using `conversation.item.create` with text summaries, as audio history cannot be directly replayed.

---

## 1. Session Limits

### Maximum Session Duration

| Platform | Maximum Duration | Notes |
|----------|------------------|-------|
| OpenAI (GA) | **60 minutes** | Increased from 30 minutes post-GA release |
| Azure OpenAI | **30 minutes** | Different from OpenAI's configuration |
| Beta (historical) | 15-30 minutes | Earlier versions had shorter limits |

**Source:** [Microsoft Learn](https://learn.microsoft.com/en-us/answers/questions/5741275/gpt-realtime-maximum-session-length-30-minutes), [OpenAI Community](https://community.openai.com/t/realtime-api-session-timeout-post-ga/1357331)

### Token Window

- **Context window:** 32,768 tokens
- **Maximum response:** 4,096 tokens
- **Effective input limit:** 28,672 tokens

### Extension Options

**There is no way to extend a session beyond the maximum duration.** The only workarounds are:

1. **Proactive session rotation:** Create a new session before timeout, transfer context via summarization
2. **Dual-session handoff:** Maintain two sessions, switch users to new session before old expires
3. **Context summarization:** Compress conversation history and inject into new session

---

## 2. Reconnection and Session Resume

### Key Finding: Sessions Cannot Be Resumed

**Sessions are not resumable after disconnection.** When a WebSocket/WebRTC connection drops:

- A new connection creates a **completely new session**
- Previous conversation context is **lost**
- There is no session ID that can be used to reconnect

**Source:** [GitHub Issue #83](https://github.com/openai/openai-realtime-api-beta/issues/83), [OpenAI Community](https://community.openai.com/t/reconnect-to-realtime-api/987911)

### Reconnection Patterns

#### Pattern 1: Context Injection via session.update

```javascript
// Store conversation history in your database
// On reconnection, inject as instructions
await ws.send(JSON.stringify({
  type: "session.update",
  session: {
    instructions: `${systemPrompt}
    
### Conversation History
${conversationHistory.map(t => `${t.role}: ${t.text}`).join('\n')}
`
  }
}));
```

**Limitations:**
- Cannot restore actual audio context
- Long histories may exceed instruction limits
- Model may behave differently without audio context

#### Pattern 2: conversation.item.create

```javascript
// Insert previous turns as text items
await ws.send(JSON.stringify({
  type: "conversation.item.create",
  previous_item_id: "root",  // Insert at beginning
  item: {
    type: "message",
    role: "system",  // Use system role for summaries
    content: [{ type: "input_text", text: summaryText }]
  }
}));
```

**Important:** Use `role: "system"` for summaries. Using `role: "assistant"` can cause the model to switch from audio to text responses.

#### Pattern 3: Dual-Session Handoff (for long sessions)

```javascript
// 1. Create new session before current expires
const newToken = await fetchEphemeralToken();
const newPc = await createNewWebRTCConnection(newToken);

// 2. Summarize current conversation
const summary = await summarizeConversation(currentHistory);

// 3. Initialize new session with summary
await initializeSessionWithContext(newPc, summary);

// 4. Switch user to new session
switchUserToNewSession(newPc);

// 5. Close old session
oldPc.close();
```

---

## 3. Ephemeral Tokens

### Overview

Ephemeral tokens allow client-side authentication without exposing your main API key.

### Token Lifecycle

| Aspect | Value | Notes |
|--------|-------|-------|
| Documented TTL | 1 minute | Per official docs |
| Actual `expires_at` | ~2 hours | Known bug/discrepancy |
| Effective validity | **~5-10 minutes** | Actual usability window |

**Source:** [OpenAI Community Discussion](https://community.openai.com/t/question-about-ephemeral-key-ttl-in-realtime-api/1114627)

### Creating Ephemeral Tokens

```javascript
// Server-side: Generate ephemeral token
const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o-realtime-preview',
    voice: 'alloy'
  })
});

const { client_secret } = await response.json();
// client_secret.value contains the ephemeral token
// client_secret.expires_at contains expiration timestamp
```

### Using with WebRTC

```javascript
// Client-side: Use ephemeral token for WebRTC
const baseUrl = "https://api.openai.com/v1/realtime/calls";
const response = await fetch(baseUrl, {
  method: "POST",
  headers: { Authorization: `Bearer ${ephemeralToken}` },
  body: formData  // Contains SDP offer and session config
});
```

### Security Considerations

- **Never expose main API key** to client
- **Refresh tokens proactively** (every 4-5 minutes recommended)
- **Set `expires_at`** when creating tokens for additional control

---

## 4. Connection Lifecycle

### WebRTC Connection States

```
[Initial] → [Connecting] → [Connected] → [Disconnected/Failed/Closed]
     ↓           ↓              ↓
  Create PC   ICE/DTLS      Active       Session ended
              negotiation   session
```

### Key Events (WebSocket)

| Event | When | Action |
|-------|------|--------|
| `session.created` | Connection established | Store session info, configure session |
| `session.updated` | Configuration applied | Verify settings |
| `error` | Any error occurs | Handle/retry based on error type |
| Connection close | Session ends | Clean up, optionally reconnect |

### Key Events (WebRTC)

| Event | When | Action |
|-------|------|--------|
| `iceconnectionstatechange` | ICE state changes | Monitor for `failed`/`disconnected` |
| `connectionstatechange` | Connection state changes | Handle `connected`, `failed`, `closed` |
| DataChannel `open` | Data channel ready | Start sending events |
| DataChannel `close` | Data channel closed | Session ended |

### Error Types

```javascript
// session_expired - Session hit maximum duration
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "code": "session_expired",
    "message": "Your session hit the maximum duration of 30 minutes."
  }
}

// Other common errors
// - "invalid_request_error" - Bad request format
// - "server_error" - OpenAI internal error
// - WebSocket close codes (1000=normal, 1006=abnormal)
```

---

## 5. Idle Timeouts

### Key Finding: No Documented Idle Timeout

There is **no officially documented idle timeout**. Sessions appear to stay open as long as:

1. The WebSocket/WebRTC connection is maintained
2. Maximum duration hasn't been reached

### Observed Behavior

- Connections can remain open without activity for extended periods
- Random disconnections have been reported but not attributed to idle timeout
- Some users report issues after ~5-10 minutes of inactivity (possibly network-related)

**Source:** [OpenAI Community](https://community.openai.com/t/realtime-api-websocket-disconnects-randomly-in-nodejs/1044456)

---

## 6. Keep-Alive Mechanisms

### WebSocket

No explicit keep-alive required, but consider:

```javascript
// Optional: Send periodic pings to detect dead connections
const keepAliveInterval = setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.ping();  // If supported by your WebSocket library
  }
}, 30000);
```

### WebRTC

WebRTC has built-in keep-alive via:
- **ICE connectivity checks** (STUN binding requests)
- **RTCP packets** for media streams
- **SCTP heartbeats** for data channels

No additional keep-alive implementation needed for WebRTC connections.

---

## 7. Multiple Concurrent Sessions

### Key Finding: Not Explicitly Limited Per Key

OpenAI's documentation doesn't specify a limit on concurrent Realtime sessions per API key.

### Practical Considerations

- **Rate limits apply** - Standard API rate limits still apply
- **Resource consumption** - Each session consumes resources (tokens, compute)
- **Cost** - Each session bills independently for input/output tokens

### Recommended Approach

```javascript
// Track active sessions
const activeSessions = new Map();

function createSession(userId) {
  // Implement your own limits
  if (activeSessions.size >= MAX_CONCURRENT_SESSIONS) {
    throw new Error('Maximum concurrent sessions reached');
  }
  
  const session = initializeRealtimeSession();
  activeSessions.set(userId, session);
  return session;
}
```

---

## 8. Session State Preservation

### What Can Be Preserved

| Data | Preservable | Method |
|------|-------------|--------|
| User text transcripts | Yes | Store and re-inject |
| Assistant text transcripts | Yes | Store and re-inject |
| Conversation summary | Yes | Generate and inject |
| Audio data | **No** | Cannot replay audio as history |
| Exact audio context | **No** | Model loses audio nuances |

### Context Summarization Pattern

From the OpenAI Cookbook:

```python
@dataclass
class ConversationState:
    history: List[Turn] = field(default_factory=list)
    summary_count: int = 0
    latest_tokens: int = 0
    summarising: bool = False

async def summarise_and_prune(ws, state):
    """Summarise old turns, delete them server-side, and prepend summary."""
    
    old_turns = state.history[:-KEEP_LAST_TURNS]
    recent_turns = state.history[-KEEP_LAST_TURNS:]
    
    # Generate summary using cheaper model
    summary_text = await run_summary_llm(old_turns)
    
    # Insert summary at conversation root
    await ws.send(json.dumps({
        "type": "conversation.item.create",
        "previous_item_id": "root",
        "item": {
            "type": "message",
            "role": "system",  # Important: Use system, not assistant
            "content": [{"type": "input_text", "text": summary_text}]
        }
    }))
    
    # Delete old items to free token window
    for turn in old_turns:
        await ws.send(json.dumps({
            "type": "conversation.item.delete",
            "item_id": turn.item_id
        }))
```

**Source:** [OpenAI Cookbook](https://cookbook.openai.com/examples/context_summarization_with_realtime_api)

### New GA Feature: Automatic Truncation

The GA release includes a `truncation` parameter that automatically optimizes context truncation while preserving relevant information.

---

## 9. Graceful Shutdown

### WebSocket Shutdown

```javascript
function gracefulShutdown(ws) {
  // 1. Stop sending new requests
  isShuttingDown = true;
  
  // 2. Wait for pending responses (optional)
  await waitForPendingResponses();
  
  // 3. Close with normal close code
  ws.close(1000, 'Normal closure');
}
```

### WebRTC Shutdown

```javascript
function gracefulShutdown(pc, dataChannel) {
  // 1. Stop sending audio
  const audioTrack = pc.getSenders()
    .find(s => s.track?.kind === 'audio')?.track;
  audioTrack?.stop();
  
  // 2. Close data channel
  dataChannel.close();
  
  // 3. Close peer connection
  pc.close();
}
```

### Server-Side Session Control (WebRTC)

For WebRTC, you cannot force-close from server. Options:

1. **Set `expires_at`** on ephemeral token creation
2. **Client-side timeout** logic
3. **Signal via separate channel** (WebSocket, HTTP) to request client close

**Source:** [OpenAI Community](https://community.openai.com/t/realtime-api-close-session/1291619)

---

## 10. WebRTC Specifics

### ICE Configuration

| Aspect | Value |
|--------|-------|
| Transport | UDP only (no TURN/TCP fallback) |
| Candidates | Host candidates only |
| STUN | Not used (candidates provided directly) |
| TURN | **Not supported** |
| Port | UDP/3478, TCP/443 (GA version) |

**Implication:** Connections may fail in restrictive corporate networks. Consider WebSocket fallback.

### GA Improvements (Sept 2025)

- **Multiple ICE candidates** (3 geographic endpoints vs 1 in beta)
- **TCP on port 443** for better firewall traversal
- **Removed redundant RTCP candidates**
- **Removed end-of-candidates** for trickle ICE flexibility

### SDP Negotiation (GA)

```javascript
// New calls endpoint combines SDP and session config
const fd = new FormData();
fd.set("sdp", pc.localDescription.sdp);
fd.set("session", JSON.stringify(sessionConfig));

const response = await fetch("https://api.openai.com/v1/realtime/calls", {
  method: "POST",
  headers: { Authorization: `Bearer ${ephemeralToken}` },
  body: fd
});

const { sdp: answerSdp } = await response.json();
await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
```

### Audio Configuration

| Setting | Value |
|---------|-------|
| Codec | Opus (primary), PCMU/PCMA fallback |
| Sample rate | 48kHz (Opus), 24kHz (PCM16) |
| FEC | In-band FEC enabled |
| DTX | Not enabled |
| RED | Not used |

### Video Support (GA)

```javascript
// Enable video by including video track
const stream = await navigator.mediaDevices.getUserMedia({
  audio: true,
  video: {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 1 }  // 1 FPS is sufficient (snapshots)
  }
});
```

Video is processed as **snapshots**, not continuous stream. The model takes images when asked to "look."

**Source:** [webrtcHacks](https://webrtchacks.com/how-openai-does-webrtc-in-the-new-gpt-realtime/)

---

## Implementation Recommendations

### 1. Session Timeout Handling

```javascript
class RealtimeSessionManager {
  constructor(maxDurationMs = 55 * 60 * 1000) {  // 55 min (buffer before 60)
    this.maxDuration = maxDurationMs;
    this.sessionStart = null;
    this.rotationWarningMs = 5 * 60 * 1000;  // Warn 5 min before
  }
  
  startSession() {
    this.sessionStart = Date.now();
    this.scheduleRotation();
  }
  
  scheduleRotation() {
    const warningTime = this.maxDuration - this.rotationWarningMs;
    
    setTimeout(() => {
      this.emit('rotation-warning', { 
        remainingMs: this.rotationWarningMs 
      });
    }, warningTime);
    
    setTimeout(() => {
      this.rotateSession();
    }, this.maxDuration);
  }
  
  async rotateSession() {
    const summary = await this.summarizeConversation();
    const newSession = await this.createNewSession(summary);
    await this.handoff(newSession);
    this.closeCurrentSession();
  }
}
```

### 2. Ephemeral Token Refresh

```javascript
class TokenManager {
  constructor(refreshIntervalMs = 4 * 60 * 1000) {  // Refresh every 4 min
    this.refreshInterval = refreshIntervalMs;
    this.currentToken = null;
  }
  
  async initialize() {
    await this.refreshToken();
    this.startRefreshLoop();
  }
  
  async refreshToken() {
    const response = await fetch('/api/realtime-token');
    const { token, expiresAt } = await response.json();
    this.currentToken = token;
    this.expiresAt = expiresAt;
  }
  
  startRefreshLoop() {
    setInterval(() => this.refreshToken(), this.refreshInterval);
  }
}
```

### 3. Reconnection with State Recovery

```javascript
class RealtimeConnection {
  async handleDisconnect() {
    // 1. Save current state
    const state = this.captureState();
    
    // 2. Attempt reconnection with backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.delay(1000 * attempt);  // Exponential backoff
        await this.connect();
        
        // 3. Restore state
        await this.restoreState(state);
        return;
      } catch (error) {
        console.error(`Reconnection attempt ${attempt} failed`);
      }
    }
    
    // 4. Give up, notify user
    this.emit('reconnection-failed');
  }
  
  captureState() {
    return {
      conversationHistory: this.history.map(t => ({
        role: t.role,
        text: t.text,
        timestamp: t.timestamp
      })),
      sessionConfig: this.currentConfig
    };
  }
  
  async restoreState(state) {
    // Generate summary from history
    const summary = await this.summarize(state.conversationHistory);
    
    // Configure new session
    await this.updateSession({
      ...state.sessionConfig,
      instructions: `${state.sessionConfig.instructions}\n\n` +
        `### Previous Conversation Summary\n${summary}`
    });
  }
}
```

---

## Sources

1. [webrtcHacks - How OpenAI does WebRTC](https://webrtchacks.com/how-openai-does-webrtc-in-the-new-gpt-realtime/) - September 2025
2. [OpenAI Cookbook - Context Summarization](https://cookbook.openai.com/examples/context_summarization_with_realtime_api) - May 2025
3. [RTC Bits - OpenAI WebRTC API Review](http://www.rtcbits.com/2024/12/openai-webrtc-api-review.html) - December 2024
4. [OpenAI Community - Session Management Discussions](https://community.openai.com/t/realtime-api-hows-everyone-managing-longer-than-30min-sessions/1144295)
5. [OpenAI Community - Ephemeral Token TTL](https://community.openai.com/t/question-about-ephemeral-key-ttl-in-realtime-api/1114627)
6. [OpenAI Community - Reconnection](https://community.openai.com/t/reconnect-to-realtime-api/987911)
7. [GitHub - openai-realtime-api-beta Issues](https://github.com/openai/openai-realtime-api-beta/issues/83)
8. [Microsoft Learn - Azure Realtime Session Limits](https://learn.microsoft.com/en-us/answers/questions/5741275/gpt-realtime-maximum-session-length-30-minutes)

---

## Confidence Level

**High confidence** for:
- Session duration limits (60 min OpenAI, 30 min Azure)
- No session resume capability
- Ephemeral token behavior
- WebRTC ICE configuration
- Context preservation patterns

**Medium confidence** for:
- Exact ephemeral token effective validity (~5-10 min)
- Concurrent session limits (not explicitly documented)
- Idle timeout behavior (no documentation found)

**Gaps/Needs Verification:**
- Official documentation on concurrent session limits
- Explicit idle timeout policy
- Server-side session termination for WebRTC
- Detailed rate limits specific to Realtime API

# Troubleshooting Guide

## Amplifier Voice System Diagnostics

This guide provides systematic troubleshooting for common issues in the Amplifier Voice system. Each section follows a consistent pattern: **Symptoms** > **Diagnostic Steps** > **Solutions**.

---

## Quick Diagnosis Flowchart

```
Problem Reported
       │
       ▼
┌──────────────────┐     No      ┌─────────────────────┐
│ Can you connect? │────────────▶│ Section 1: Connection│
└────────┬─────────┘             └─────────────────────┘
         │ Yes
         ▼
┌──────────────────┐     No      ┌─────────────────────┐
│ Can you hear AI? │────────────▶│ Section 2: Audio     │
└────────┬─────────┘             └─────────────────────┘
         │ Yes
         ▼
┌──────────────────┐     No      ┌─────────────────────┐
│ Can AI hear you? │────────────▶│ Section 2: Audio     │
└────────┬─────────┘             └─────────────────────┘
         │ Yes
         ▼
┌──────────────────┐     No      ┌─────────────────────┐
│ Do tools work?   │────────────▶│ Section 3: Tools     │
│                  │             │ Section 4: Amplifier │
└────────┬─────────┘             └─────────────────────┘
         │ Yes
         ▼
┌──────────────────┐     No      ┌─────────────────────┐
│ Session stable?  │────────────▶│ Section 5: Sessions  │
└────────┬─────────┘             └─────────────────────┘
         │ Yes
         ▼
┌──────────────────┐     No      ┌─────────────────────┐
│ Performance OK?  │────────────▶│ Section 6: Performance│
└──────────────────┘             └─────────────────────┘
```

---

## 1. Connection Problems

### 1.1 WebRTC Connection Failed

**Error Code:** `CONN-WS-001`

**Symptoms:**
- "WebRTC connection failed" error message
- Connection state stuck on "connecting"
- ICE connection state shows "failed" or "checking"
- No audio in either direction

**Diagnostic Steps:**

1. **Check browser console** for WebRTC errors:
   ```
   [WebRTC] Connection state: failed
   [WebRTC] ICE connection failed
   ```

2. **Open Chrome WebRTC Internals** (`chrome://webrtc-internals`):
   - Look for ICE candidate pairs
   - Check if any candidates show "succeeded"
   - Verify STUN server connectivity

3. **Verify server is running:**
   ```bash
   curl http://127.0.0.1:8080/health
   ```

4. **Check network conditions:**
   - Firewall blocking UDP ports?
   - Corporate proxy intercepting WebRTC?
   - VPN causing NAT issues?

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Server not running | Start voice server: `cd voice-server && uv run python -m voice_server.start` |
| STUN server unreachable | Check firewall allows UDP to `stun.l.google.com:19302` |
| Corporate firewall | Request UDP ports 3478, 5349, 10000-60000 be opened |
| VPN interference | Disconnect VPN or use split tunneling |
| Browser permissions | Reset site permissions, try incognito mode |

**Prevention:**
- Use connection health monitoring (`useConnectionHealth` hook)
- Implement exponential backoff reconnection (1s, 2s, 4s, 8s, max 30s)

---

### 1.2 WebSocket Connection Lost

**Error Code:** `CONN-WS-002`

**Symptoms:**
- "Connection lost. Reconnecting..." message
- Data channel state shows "closed"
- Periodic disconnections during conversation
- Browser console shows `onclose` event

**Diagnostic Steps:**

1. **Check connection health metrics:**
   ```typescript
   // In browser console
   healthManager.getMetrics()
   // Look for: lastEventTime, connectionStateHistory
   ```

2. **Monitor data channel state:**
   ```
   [WebRTC] Data channel closed
   [WebRTC] Connection state: disconnected
   ```

3. **Check network stability:**
   - Is WiFi signal strong?
   - Any network switches (4G ↔ WiFi)?
   - Laptop sleep/wake cycles?

4. **Review server logs:**
   ```bash
   # Look for connection close reasons
   grep "connection" voice-server.log
   ```

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Network instability | Move closer to router, use wired connection |
| Browser tab backgrounded | Keep tab active or use service worker |
| Laptop sleep | Adjust power settings, use keep-alive |
| Server restart | Implement session persistence |
| OpenAI API timeout | Session hit 60-minute limit (see Section 5) |

**Recovery Code Pattern:**
```typescript
// Auto-reconnect with state preservation
const handleDisconnect = async (reason: DisconnectReason) => {
  console.log('Disconnected:', reason);
  
  // Preserve conversation state
  const savedContext = transcriptStore.getState().messages;
  
  // Attempt reconnection with backoff
  await reconnectWithBackoff({
    maxRetries: 5,
    baseDelay: 1000,
    onSuccess: () => injectContext(savedContext)
  });
};
```

---

### 1.3 SDP Exchange Failed

**Error Code:** `CONN-NET-003`

**Symptoms:**
- "SDP exchange failed" error
- Connection never establishes after session creation
- HTTP error from `/sdp` endpoint

**Diagnostic Steps:**

1. **Check `/session` response:**
   ```bash
   curl -X POST http://127.0.0.1:8080/session \
     -H "Content-Type: application/json" \
     -d '{"voice": "ash"}'
   ```
   Expected: `{"client_secret": {"value": "..."}}`

2. **Verify ephemeral token:**
   - Token should be present in session response
   - Token expires quickly - check timing

3. **Test SDP endpoint directly:**
   - Requires valid Authorization header
   - Content-Type must be `application/sdp`

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| No client_secret returned | Check OpenAI API key in server `.env` |
| Token expired | Create new session, don't cache tokens |
| Invalid SDP format | Ensure local description is set before exchange |
| Server-side error | Check server logs for API errors |

---

### 1.4 ICE Connection Failed

**Error Code:** `CONN-NET-002`

**Symptoms:**
- ICE state stuck on "checking" for >10 seconds
- "ICE connection failed - network issue" error
- One-way or no audio despite "connected" state

**Diagnostic Steps:**

1. **Chrome WebRTC Internals analysis:**
   - Navigate to `chrome://webrtc-internals`
   - Find your connection's ICE candidate pairs
   - Look for candidates with `state: succeeded`

2. **Check candidate types:**
   ```
   host: Direct local network (best)
   srflx: Server reflexive - via STUN (good)
   relay: Via TURN server (fallback)
   ```

3. **Identify blocking:**
   ```
   No srflx candidates = STUN blocked
   No relay candidates = TURN not configured
   Only host candidates = NAT traversal failing
   ```

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Symmetric NAT | Configure TURN server for relay |
| UDP blocked | Enable TURN over TCP (port 443) |
| Firewall rules | Whitelist Google STUN servers |
| IPv6 issues | Force IPv4 in RTCConfiguration |

**TURN Server Configuration (if needed):**
```typescript
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { 
      urls: 'turn:your-turn-server.com:3478',
      username: 'user',
      credential: 'password'
    }
  ]
});
```

---

## 2. Audio Issues

### 2.1 No Sound from AI (Can't Hear Responses)

**Error Code:** `AUDIO-SPK-001`

**Symptoms:**
- AI transcription appears but no audio playback
- Audio element exists but silent
- Volume controls unresponsive

**Diagnostic Steps:**

1. **Check audio element state:**
   ```javascript
   // In browser console
   const audio = document.querySelector('audio');
   console.log({
     srcObject: audio.srcObject,
     paused: audio.paused,
     muted: audio.muted,
     volume: audio.volume,
     readyState: audio.readyState
   });
   ```

2. **Verify remote track received:**
   ```
   [WebRTC] ontrack event fired
   Audio streams: 1
   ```

3. **Check AudioContext state:**
   ```javascript
   // Many browsers require user interaction
   const ctx = new AudioContext();
   console.log(ctx.state); // Should be "running", not "suspended"
   ```

4. **System audio check:**
   - Is system volume up?
   - Correct output device selected?
   - Browser tab muted?

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| AudioContext suspended | Add user interaction before playing (click handler) |
| No srcObject on audio | Verify `pc.ontrack` handler sets `audio.srcObject` |
| Audio element muted | Check `audio.muted = false; audio.volume = 1.0` |
| Autoplay blocked | Call `audio.play()` after user gesture |
| Wrong output device | Use `audio.setSinkId(deviceId)` |

**User Interaction Pattern:**
```typescript
// Require user click before enabling audio
const enableAudio = async () => {
  const ctx = new AudioContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  await audioRef.current?.play();
};

// Button: "Click to Enable Voice"
<button onClick={enableAudio}>Start Conversation</button>
```

---

### 2.2 AI Can't Hear User (No Input)

**Error Code:** `AUDIO-MIC-001` through `AUDIO-MIC-005`

**Symptoms:**
- Transcription shows nothing when you speak
- "I'm not hearing anything" from AI
- Microphone indicator doesn't respond
- `getUserMedia` errors in console

**Diagnostic Steps:**

1. **Check microphone permission:**
   ```javascript
   navigator.permissions.query({ name: 'microphone' })
     .then(result => console.log('Mic permission:', result.state));
   ```

2. **Verify media stream active:**
   ```javascript
   const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
   console.log({
     active: stream.active,
     tracks: stream.getAudioTracks().map(t => ({
       enabled: t.enabled,
       muted: t.muted,
       readyState: t.readyState
     }))
   });
   ```

3. **Test audio levels:**
   ```javascript
   // Create analyzer to check if audio is being captured
   const audioCtx = new AudioContext();
   const analyser = audioCtx.createAnalyser();
   const source = audioCtx.createMediaStreamSource(stream);
   source.connect(analyser);
   
   const dataArray = new Uint8Array(analyser.frequencyBinCount);
   analyser.getByteFrequencyData(dataArray);
   console.log('Audio level:', Math.max(...dataArray)); // Should be >0 when speaking
   ```

4. **Common error messages:**
   | Error | Meaning |
   |-------|---------|
   | `NotAllowedError` | Permission denied |
   | `NotFoundError` | No microphone detected |
   | `NotReadableError` | Mic in use by another app |
   | `OverconstrainedError` | Requested constraints unavailable |

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Permission denied | Click lock icon in URL bar, allow microphone |
| No microphone | Connect microphone, check system settings |
| Mic in use | Close other apps (Zoom, Teams, etc.) |
| Wrong device | Select correct input in browser settings |
| Track disabled | Ensure `track.enabled = true` |
| Browser bug | Try different browser (Chrome recommended) |

**Permission Reset (Chrome):**
1. Click lock icon in URL bar
2. Click "Site settings"
3. Reset "Microphone" to "Ask"
4. Refresh page

---

### 2.3 Echo / Feedback Loop

**Error Code:** `AUDIO-QUALITY-001`

**Symptoms:**
- AI hears itself and responds to own speech
- Feedback loop of repeated responses
- Echo in audio output

**Diagnostic Steps:**

1. **Check echo cancellation enabled:**
   ```javascript
   const stream = await navigator.mediaDevices.getUserMedia({
     audio: {
       echoCancellation: true,  // Should be true
       noiseSuppression: true,
       autoGainControl: true
     }
   });
   ```

2. **Verify audio setup:**
   - Are speakers playing into microphone?
   - Is there acoustic feedback in the room?

3. **Check VAD settings:**
   - Is the AI detecting its own audio as user speech?

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Echo cancellation off | Enable in `getUserMedia` constraints |
| Speakers too loud | Use headphones |
| Poor room acoustics | Move to quieter space, use directional mic |
| Browser AEC failing | Try different browser or device |

**Recommended Audio Configuration:**
```typescript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    // Optional: specific device
    deviceId: preferredMicrophoneId
  }
});
```

---

### 2.4 Poor Audio Quality (Choppy/Robotic)

**Error Code:** `AUDIO-QUALITY-001`

**Symptoms:**
- Choppy or stuttering audio
- Robotic/metallic voice quality
- Words getting cut off
- Delayed or out-of-sync audio

**Diagnostic Steps:**

1. **Check WebRTC statistics:**
   ```javascript
   const stats = await pc.getStats();
   stats.forEach(report => {
     if (report.type === 'inbound-rtp' && report.kind === 'audio') {
       console.log({
         packetsReceived: report.packetsReceived,
         packetsLost: report.packetsLost,
         jitter: report.jitter * 1000, // Convert to ms
         // Calculate packet loss %
         lossRate: (report.packetsLost / 
           (report.packetsReceived + report.packetsLost) * 100).toFixed(2) + '%'
       });
     }
   });
   ```

2. **Quality thresholds:**
   | Metric | Good | Acceptable | Poor |
   |--------|------|------------|------|
   | Packet Loss | <1% | <3% | >5% |
   | Jitter | <20ms | <50ms | >50ms |
   | RTT | <100ms | <200ms | >300ms |

3. **Network diagnosis:**
   ```bash
   # Test network stability
   ping -c 20 stun.l.google.com
   
   # Check for packet loss pattern
   # Consistent loss = network issue
   # Burst loss = congestion
   ```

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| High packet loss | Use wired connection, reduce network load |
| High jitter | Close bandwidth-heavy apps, QoS settings |
| Network congestion | Reduce video streaming, large downloads |
| Poor WiFi | Move closer to router, change channel |
| Bluetooth issues | Use wired headphones |

---

### 2.5 VAD Not Detecting Speech

**Error Code:** `AUDIO-MIC-005`

**Symptoms:**
- AI never responds even when you speak clearly
- No "user is speaking" indication
- Transcription is empty or fragmented

**Diagnostic Steps:**

1. **Check VAD configuration:**
   ```typescript
   // Current settings in useWebRTC.ts
   turn_detection: {
     type: 'server_vad',
     threshold: 0.5,          // Sensitivity (0-1)
     prefix_padding_ms: 300,  // Audio before speech
     silence_duration_ms: 500 // Silence to end turn
   }
   ```

2. **Test different VAD thresholds:**
   - Lower threshold (0.3) = more sensitive, may catch noise
   - Higher threshold (0.7) = less sensitive, may miss quiet speech

3. **Verify audio is reaching server:**
   - Check outbound RTP packets increasing
   - Server should log audio frames received

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Threshold too high | Lower to 0.3-0.4 |
| Speaking too softly | Speak louder, move closer to mic |
| Background noise | Enable noise suppression, quieter environment |
| Wrong language setting | Check transcription language matches speech |

**Recommended VAD Settings by Environment:**

```typescript
// Quiet environment (home office)
{ threshold: 0.5, silence_duration_ms: 500 }

// Noisy environment (cafe, open office)
{ threshold: 0.6, silence_duration_ms: 600, noise_reduction: { type: 'near_field' } }

// Quick interactions (commands)
{ threshold: 0.4, silence_duration_ms: 300 }
```

---

## 3. Tool Failures

### 3.1 Tool Execution Timeout

**Error Code:** `TOOL-EXEC-002`

**Symptoms:**
- "That's taking too long" message from AI
- Tool calls never complete
- Long pauses during task execution

**Diagnostic Steps:**

1. **Check server logs for tool execution:**
   ```bash
   grep "Executing tool" voice-server.log
   grep "Tool.*completed\|failed" voice-server.log
   ```

2. **Identify slow tools:**
   ```python
   # Add timing to tool execution
   import time
   start = time.time()
   result = await tool.execute(arguments)
   elapsed = time.time() - start
   logger.info(f"Tool {tool_name} took {elapsed:.2f}s")
   ```

3. **Check Amplifier task status:**
   - Is the task tool spawning agents?
   - Are spawned agents completing?

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Complex task | Break into smaller steps |
| External service slow | Add timeouts, use caching |
| Agent stuck | Check agent logs, verify spawn capability |
| Resource contention | Reduce concurrent operations |

**Timeout Configuration:**
```python
# In amplifier_bridge.py
TOOL_TIMEOUT = 30  # seconds

async def execute_tool_with_timeout(self, tool_name: str, arguments: dict):
    try:
        return await asyncio.wait_for(
            self._execute_tool(tool_name, arguments),
            timeout=TOOL_TIMEOUT
        )
    except asyncio.TimeoutError:
        return ToolResult(success=False, error=f"Tool {tool_name} timed out")
```

---

### 3.2 Tool Not Found

**Error Code:** `TOOL-EXEC-003`

**Symptoms:**
- "I don't have the ability to do that" message
- Tool call returns "Unknown tool" error
- Expected functionality unavailable

**Diagnostic Steps:**

1. **List available tools:**
   ```bash
   curl http://127.0.0.1:8080/tools | jq
   ```

2. **Check tool discovery:**
   ```python
   # In server logs
   grep "Discovered tool" voice-server.log
   grep "tools" voice-server.log | grep -i "count"
   ```

3. **Verify Amplifier bridge initialization:**
   ```bash
   curl http://127.0.0.1:8080/health | jq '.amplifier'
   ```

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Bridge not initialized | Wait for startup, check logs |
| Bundle missing tool | Check bundle configuration |
| Tool not in REALTIME_TOOLS | Add to exposed tools list |
| Module not loaded | Check module installation |

**Check REALTIME_TOOLS Configuration:**
```python
# In amplifier_bridge.py
# Only these tools are exposed to voice model
REALTIME_TOOLS = {"task"}  # Add other tools as needed
```

---

### 3.3 Tool Execution Failed

**Error Code:** `TOOL-EXEC-001`

**Symptoms:**
- "I ran into a problem doing that" message
- Tool returns error status
- Partial or no results

**Diagnostic Steps:**

1. **Check detailed error in logs:**
   ```bash
   grep "Tool.*failed" voice-server.log
   grep -A 5 "execute_tool" voice-server.log | grep -i error
   ```

2. **Examine tool arguments:**
   ```python
   # Log what was sent
   logger.info(f"Tool args: {json.dumps(arguments, indent=2)}")
   ```

3. **Test tool directly:**
   ```bash
   curl -X POST http://127.0.0.1:8080/execute/task \
     -H "Content-Type: application/json" \
     -d '{"instruction": "test task"}'
   ```

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Invalid arguments | Check schema, validate input |
| Permission denied | Verify file/resource access |
| External service error | Check service status, retry |
| Bug in tool code | Check tool logs, fix implementation |

---

### 3.4 Tool Result Too Large

**Error Code:** `TOOL-RESULT-001`

**Symptoms:**
- Tool completes but result truncated
- "Let me summarize the key points" message
- Incomplete data returned

**Diagnostic Steps:**

1. **Check result size:**
   ```python
   result = await tool.execute(arguments)
   result_json = json.dumps(result)
   logger.info(f"Result size: {len(result_json)} bytes")
   ```

2. **Identify large fields:**
   - File contents?
   - Long lists?
   - Verbose output?

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Large file content | Return summary or path instead |
| Too many results | Paginate, return top N |
| Verbose output | Filter to essential fields |

---

## 4. Amplifier Integration Issues

### 4.1 Amplifier Bridge Not Initialized

**Error Code:** `AMP-CONN-001`

**Symptoms:**
- 503 "Amplifier bridge not initialized" errors
- No tools available
- Health check shows `amplifier.enabled: false`

**Diagnostic Steps:**

1. **Check server startup logs:**
   ```bash
   grep -i "amplifier\|bridge\|initializ" voice-server.log
   ```

2. **Verify bundle exists:**
   ```bash
   # Check if bundle can be loaded
   amplifier bundle info amplifier-dev
   ```

3. **Check environment variables:**
   ```bash
   # Required for full functionality
   echo $OPENAI_API_KEY
   echo $ANTHROPIC_API_KEY  # For task tool delegation
   ```

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Bundle not found | Install bundle: `amplifier bundle install amplifier-dev` |
| Missing API key | Set `OPENAI_API_KEY` in `.env` |
| Import error | Install amplifier-foundation: `pip install amplifier-foundation` |
| Module resolution failed | Run `amplifier bundle prepare amplifier-dev` |

**Startup Verification:**
```bash
# Start server and watch for initialization
cd voice-server
uv run python -m voice_server.start 2>&1 | grep -E "(Amplifier|tools|initialized)"

# Expected output:
# Initializing Amplifier bridge...
# Amplifier bridge initialized with X tools
```

---

### 4.2 Task Tool Agent Spawn Failed

**Error Code:** `AMP-AGENT-001`

**Symptoms:**
- Task delegations fail
- "Agent not found" errors
- No response from spawned agents

**Diagnostic Steps:**

1. **Check spawn capability registered:**
   ```python
   # In logs
   grep "session.spawn" voice-server.log
   # Should see: "Registered session.spawn capability"
   ```

2. **Verify agent configuration:**
   ```bash
   # List available agents
   amplifier agent list
   ```

3. **Check Anthropic API key:**
   ```bash
   # Required for agent execution
   echo $ANTHROPIC_API_KEY
   ```

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Spawn capability missing | Restart server, check initialization |
| Agent not in bundle | Add agent to bundle configuration |
| No provider configured | Add Anthropic provider to bundle |
| API key missing | Set `ANTHROPIC_API_KEY` |

---

### 4.3 Amplifier Session Lost

**Error Code:** `AMP-CONN-002`

**Symptoms:**
- Tools stop working mid-conversation
- "I lost connection to my tools" message
- Tool calls return errors after working initially

**Diagnostic Steps:**

1. **Check session state:**
   ```python
   # In amplifier_bridge.py
   logger.info(f"Session active: {self._session is not None}")
   logger.info(f"Coordinator active: {self._coordinator is not None}")
   ```

2. **Look for cleanup triggers:**
   ```bash
   grep -i "cleanup\|close\|shutdown" voice-server.log
   ```

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Server restart | Reconnect will create new session |
| Memory pressure | Increase server resources |
| Timeout | Extend session timeouts |
| Explicit cleanup | Only cleanup on shutdown |

---

### 4.4 Context Size Exceeded

**Error Code:** `AMP-CONTEXT-001`

**Symptoms:**
- "We've covered a lot of ground" message
- Earlier conversation details forgotten
- Token limit errors in logs

**Diagnostic Steps:**

1. **Estimate context size:**
   ```python
   # Rough token count (4 chars ~ 1 token)
   context_text = json.dumps(conversation_history)
   estimated_tokens = len(context_text) / 4
   logger.info(f"Estimated context: {estimated_tokens} tokens")
   ```

2. **Check conversation length:**
   - How many messages?
   - Any large tool outputs?
   - File contents in context?

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Long conversation | Summarize and restart session |
| Large tool outputs | Truncate or summarize results |
| File contents | Reference files instead of including |

---

## 5. Session Problems

### 5.1 Session Creation Failed

**Error Code:** `SESSION-CREATE-001`

**Symptoms:**
- Cannot start new conversation
- "I'm having trouble starting up" message
- `/session` endpoint returns error

**Diagnostic Steps:**

1. **Test session creation:**
   ```bash
   curl -X POST http://127.0.0.1:8080/session \
     -H "Content-Type: application/json" \
     -d '{"voice": "ash"}' -v
   ```

2. **Check OpenAI API status:**
   - Visit status.openai.com
   - Test API key directly

3. **Verify server state:**
   ```bash
   curl http://127.0.0.1:8080/health
   ```

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Invalid API key | Check/rotate OpenAI API key |
| API quota exceeded | Check usage, upgrade plan |
| Network issue | Verify server can reach api.openai.com |
| Server not ready | Wait for initialization |

---

### 5.2 Session Expired (60-Minute Limit)

**Error Code:** `SESSION-EXPIRED-001`

**Symptoms:**
- Session disconnects after ~60 minutes
- "It's been a while" message before disconnect
- Connection health shows "session_limit" reason

**Diagnostic Steps:**

1. **Check session duration:**
   ```typescript
   const duration = healthManager.getSessionDurationMs();
   console.log(`Session duration: ${duration / 60000} minutes`);
   ```

2. **Monitor session warnings:**
   ```typescript
   // Should fire at 55 minutes
   healthManager.setCallbacks({
     onSessionWarning: (remainingMs) => {
       console.log(`Session expires in ${remainingMs / 60000} minutes`);
     }
   });
   ```

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| OpenAI hard limit | This is expected - implement session rotation |
| No warning shown | Add session warning UI |
| Context lost | Implement context persistence and resumption |

**Session Rotation Pattern:**
```typescript
// At 55 minutes, prepare for rotation
const handleSessionWarning = async (remainingMs: number) => {
  // Save current context
  const context = await saveConversationContext();
  
  // Warn user
  showNotification(`Session refreshing in ${Math.round(remainingMs/60000)} minutes`);
  
  // At 58 minutes, create new session
  if (remainingMs < 120000) {
    const newSession = await createSession();
    await injectContext(context);
  }
};
```

---

### 5.3 Session Restore Failed

**Error Code:** `SESSION-RESTORE-001`

**Symptoms:**
- Can't resume previous conversation
- "I couldn't restore our previous conversation" message
- Lost conversation history

**Diagnostic Steps:**

1. **Check transcript storage:**
   ```bash
   ls -la voice-server/transcripts/
   ```

2. **Verify session exists:**
   ```bash
   curl http://127.0.0.1:8080/sessions/{session_id}
   ```

3. **Test resume endpoint:**
   ```bash
   curl -X POST http://127.0.0.1:8080/sessions/{session_id}/resume \
     -H "Content-Type: application/json" \
     -d '{"voice": "ash"}'
   ```

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Session not found | Check session_id, may have expired |
| Corrupt transcript | Delete and start fresh |
| Context injection failed | Check data channel is open |

---

### 5.4 Stale Connection Detected

**Error Code:** `SESSION-STATE-001`

**Symptoms:**
- Connected but no events received
- Health status shows "critical"
- AI appears frozen

**Diagnostic Steps:**

1. **Check time since last event:**
   ```typescript
   const timeSinceEvent = healthManager.getTimeSinceLastEventMs();
   console.log(`Last event: ${timeSinceEvent / 1000}s ago`);
   // >30s = stale connection
   ```

2. **Verify data channel:**
   ```typescript
   console.log('Data channel state:', dataChannel?.readyState);
   // Should be 'open'
   ```

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Network issue | Check connectivity, reconnect |
| Server overloaded | Retry later |
| OpenAI API issue | Check status, wait |
| Data channel closed silently | Implement keepalive ping |

---

## 6. Performance Issues

### 6.1 High Response Latency

**Symptoms:**
- 3-5+ second delay before AI responds
- Noticeable pause after speaking
- "I'm experiencing some delay" message

**Diagnostic Steps:**

1. **Measure component latencies:**
   ```
   Total latency breakdown:
   - Audio capture: ~70ms
   - STT processing: ~350ms
   - LLM response: ~600-1000ms
   - TTS synthesis: ~100ms
   - Network RTT: ~100ms
   
   Expected total: ~1.2-1.6s
   ```

2. **Check network RTT:**
   ```javascript
   const stats = await pc.getStats();
   stats.forEach(report => {
     if (report.type === 'remote-inbound-rtp') {
       console.log('RTT:', report.roundTripTime * 1000, 'ms');
     }
   });
   ```

3. **Monitor tool execution time:**
   - Are tools adding latency?
   - Agent delegation delays?

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Network latency | Use closer servers, better connection |
| LLM processing | Reduce context size, use streaming |
| Tool execution | Optimize tools, add caching |
| VAD over-buffering | Reduce silence_duration_ms |

**Latency Optimization Targets:**
| Component | Target | Maximum |
|-----------|--------|---------|
| STT first byte | <250ms | 500ms |
| LLM first token | <500ms | 1000ms |
| Tool execution | <2s | 30s |
| Total response | <2s | 5s |

---

### 6.2 High CPU Usage

**Symptoms:**
- Browser tab sluggish
- Fan running constantly
- Audio stuttering

**Diagnostic Steps:**

1. **Check browser performance:**
   - Open DevTools > Performance
   - Record during conversation
   - Look for long tasks

2. **Monitor memory:**
   - DevTools > Memory
   - Check for growing heap

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Audio processing | Reduce sample rate if possible |
| Large context | Implement context pruning |
| Memory leak | Cleanup event listeners, clear old data |
| Many re-renders | Optimize React components |

---

### 6.3 Memory Leaks

**Symptoms:**
- Page becomes slower over time
- Memory usage grows continuously
- Eventually crashes or freezes

**Diagnostic Steps:**

1. **Track memory over time:**
   ```javascript
   setInterval(() => {
     if (performance.memory) {
       console.log('Heap:', performance.memory.usedJSHeapSize / 1024 / 1024, 'MB');
     }
   }, 10000);
   ```

2. **Check for common leaks:**
   - Event listeners not removed
   - Intervals not cleared
   - Large arrays growing

**Solutions:**

| Root Cause | Solution |
|------------|----------|
| Event listeners | Remove in cleanup/unmount |
| Intervals | Clear with clearInterval |
| Transcript growth | Limit stored messages |
| WebRTC not cleaned | Call cleanup() on disconnect |

**Cleanup Pattern:**
```typescript
useEffect(() => {
  const interval = setInterval(checkHealth, 5000);
  
  return () => {
    clearInterval(interval);
    cleanup(); // WebRTC cleanup
    healthManager.reset();
  };
}, []);
```

---

## Diagnostic Tools Summary

### Browser Tools

| Tool | Purpose | Access |
|------|---------|--------|
| WebRTC Internals | Connection debugging | `chrome://webrtc-internals` |
| DevTools Console | Error logging | F12 > Console |
| DevTools Network | HTTP debugging | F12 > Network |
| DevTools Performance | CPU/memory profiling | F12 > Performance |

### Server Tools

| Command | Purpose |
|---------|---------|
| `curl /health` | Check server status |
| `curl /tools` | List available tools |
| `curl /sessions` | List sessions |
| `grep voice-server.log` | Search server logs |

### Connection Health API

```typescript
// Get full health report
const metrics = healthManager.getMetrics();
const status = healthManager.getHealthStatus();
const eventLog = healthManager.getEventLog();

console.log({
  sessionDuration: healthManager.formatDuration(healthManager.getSessionDurationMs()),
  idleTime: healthManager.formatDuration(healthManager.getIdleTimeMs()),
  timeSinceLastEvent: healthManager.formatDuration(healthManager.getTimeSinceLastEventMs()),
  reconnectCount: metrics.reconnectCount,
  status,
  recentEvents: eventLog.slice(-10)
});
```

---

## Error Code Quick Reference

| Code | Category | Severity | Common Cause |
|------|----------|----------|--------------|
| CONN-WS-001 | Connection | ERROR | Server unreachable |
| CONN-WS-002 | Connection | WARNING | Network instability |
| CONN-NET-002 | Connection | INFO | High latency |
| AUDIO-MIC-001 | Audio | CRITICAL | Permission denied |
| AUDIO-MIC-002 | Audio | CRITICAL | No microphone |
| AUDIO-SPK-001 | Audio | ERROR | Playback failed |
| TOOL-EXEC-001 | Tool | ERROR | Execution failed |
| TOOL-EXEC-002 | Tool | WARNING | Timeout |
| AMP-CONN-001 | Amplifier | ERROR | Bridge not initialized |
| AMP-TASK-001 | Amplifier | ERROR | Task failed |
| SESSION-CREATE-001 | Session | CRITICAL | Cannot create session |
| SESSION-EXPIRED-001 | Session | INFO | 60-minute limit |

---

## Getting Help

### Collect Debug Information

Before reporting an issue, gather:

1. **Browser console logs** (errors and warnings)
2. **Server logs** (relevant section)
3. **Health metrics** (`healthManager.getMetrics()`)
4. **WebRTC stats** (from `chrome://webrtc-internals`)
5. **Steps to reproduce**

### Log Template

```
## Environment
- Browser: Chrome 120 / Firefox 121 / Safari 17
- OS: macOS 14 / Windows 11 / Ubuntu 22
- Voice Server Version: X.X.X

## Issue Description
[What happened vs what was expected]

## Steps to Reproduce
1. ...
2. ...

## Error Messages
[Paste console errors]

## Health Metrics
[Paste healthManager.getMetrics() output]

## Additional Context
[Network conditions, time of day, etc.]
```

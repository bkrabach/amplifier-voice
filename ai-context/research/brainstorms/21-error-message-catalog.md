# Error Message Catalog

## Voice-Friendly Error Communication System

This catalog defines standardized error codes, technical descriptions, and voice-friendly messages for all error conditions in the Amplifier Voice system. Voice messages are designed to be natural, non-technical, and actionable.

---

## Design Principles

### Voice Message Guidelines

1. **Be conversational** - Sound like a helpful assistant, not a computer
2. **Be brief** - Users can't re-read voice messages
3. **Be actionable** - Always suggest what the user can do
4. **Be honest** - Don't blame the user for system issues
5. **Be calm** - Never sound alarmed or frustrated
6. **Avoid jargon** - No technical terms in voice output

### Severity Levels

| Level | Definition | Voice Behavior |
|-------|------------|----------------|
| `CRITICAL` | System unusable, requires intervention | Speak immediately, suggest alternative |
| `ERROR` | Feature unavailable, workaround possible | Speak promptly, offer alternatives |
| `WARNING` | Degraded experience, auto-recovering | Mention briefly, continue if possible |
| `INFO` | Notable event, no action needed | May speak or show visually only |

### Error Code Format

```
{CATEGORY}-{SUBCATEGORY}-{NUMBER}

Examples:
CONN-WS-001    - Connection > WebSocket > Error 001
AUDIO-MIC-002  - Audio > Microphone > Error 002
TOOL-EXEC-003  - Tool > Execution > Error 003
```

---

## 1. Connection Errors (CONN)

### CONN-WS-001: WebSocket Connection Failed

| Field | Value |
|-------|-------|
| **Code** | `CONN-WS-001` |
| **Technical** | WebSocket handshake failed. Server unreachable or rejected connection. |
| **Voice Message** | "I'm having trouble connecting right now. Let me try again." |
| **Recovery** | Auto-retry with exponential backoff (1s, 2s, 4s, 8s, max 30s) |
| **Severity** | `ERROR` |

### CONN-WS-002: WebSocket Connection Lost

| Field | Value |
|-------|-------|
| **Code** | `CONN-WS-002` |
| **Technical** | WebSocket connection dropped unexpectedly. `onclose` event received. |
| **Voice Message** | "Connection lost. Reconnecting..." |
| **Recovery** | Preserve state, auto-reconnect, resume conversation context |
| **Severity** | `WARNING` |

**Follow-up on success:**
> "I'm back. Where were we?"

### CONN-WS-003: WebSocket Connection Timeout

| Field | Value |
|-------|-------|
| **Code** | `CONN-WS-003` |
| **Technical** | Connection attempt exceeded timeout threshold (default: 10s). |
| **Voice Message** | "This is taking longer than usual. Your network might be slow." |
| **Recovery** | Retry with extended timeout, suggest network check after 3 failures |
| **Severity** | `WARNING` |

### CONN-NET-001: Network Unavailable

| Field | Value |
|-------|-------|
| **Code** | `CONN-NET-001` |
| **Technical** | `navigator.onLine` returns false or network interface unavailable. |
| **Voice Message** | "You seem to be offline. I'll reconnect when your network is back." |
| **Recovery** | Listen for `online` event, auto-reconnect when network returns |
| **Severity** | `ERROR` |

### CONN-NET-002: High Latency Detected

| Field | Value |
|-------|-------|
| **Code** | `CONN-NET-002` |
| **Technical** | Round-trip time exceeds 500ms threshold consistently. |
| **Voice Message** | "I'm experiencing some delay. Bear with me." |
| **Recovery** | Reduce audio quality, batch requests, increase timeouts |
| **Severity** | `INFO` |

### CONN-NET-003: DNS Resolution Failed

| Field | Value |
|-------|-------|
| **Code** | `CONN-NET-003` |
| **Technical** | DNS lookup failed for API endpoint. |
| **Voice Message** | "I can't reach the server right now. Let me keep trying." |
| **Recovery** | Retry with backoff, fallback to cached IP if available |
| **Severity** | `ERROR` |

### CONN-SSL-001: TLS/SSL Handshake Failed

| Field | Value |
|-------|-------|
| **Code** | `CONN-SSL-001` |
| **Technical** | SSL certificate validation failed or handshake error. |
| **Voice Message** | "There's a security issue with the connection. Please try again later." |
| **Recovery** | Log for investigation, do not bypass security |
| **Severity** | `CRITICAL` |

### CONN-PROXY-001: Proxy/Firewall Blocked

| Field | Value |
|-------|-------|
| **Code** | `CONN-PROXY-001` |
| **Technical** | Connection blocked by corporate proxy or firewall (403/407 status). |
| **Voice Message** | "Your network might be blocking this connection. You may need to check your network settings." |
| **Recovery** | Suggest contacting IT support, log detailed error |
| **Severity** | `ERROR` |

---

## 2. Audio Errors (AUDIO)

### AUDIO-MIC-001: Microphone Permission Denied

| Field | Value |
|-------|-------|
| **Code** | `AUDIO-MIC-001` |
| **Technical** | `getUserMedia` rejected with `NotAllowedError`. User denied permission. |
| **Voice Message** | "I need microphone access to hear you. Please allow microphone permission in your browser settings." |
| **Recovery** | Show visual guide to enable permissions, offer text input fallback |
| **Severity** | `CRITICAL` |

### AUDIO-MIC-002: Microphone Not Found

| Field | Value |
|-------|-------|
| **Code** | `AUDIO-MIC-002` |
| **Technical** | `getUserMedia` rejected with `NotFoundError`. No audio input device. |
| **Voice Message** | "I can't find a microphone. Please connect one or check your audio settings." |
| **Recovery** | Monitor for device connection, offer text input fallback |
| **Severity** | `CRITICAL` |

### AUDIO-MIC-003: Microphone In Use

| Field | Value |
|-------|-------|
| **Code** | `AUDIO-MIC-003` |
| **Technical** | `getUserMedia` rejected with `NotReadableError`. Device in use by another app. |
| **Voice Message** | "Your microphone seems to be used by another app. Please close it and try again." |
| **Recovery** | Retry button, suggest closing other apps |
| **Severity** | `ERROR` |

### AUDIO-MIC-004: Microphone Hardware Error

| Field | Value |
|-------|-------|
| **Code** | `AUDIO-MIC-004` |
| **Technical** | Audio input device malfunction or driver error. |
| **Voice Message** | "There's an issue with your microphone. Try unplugging and reconnecting it." |
| **Recovery** | Prompt device reconnection, offer alternative input |
| **Severity** | `ERROR` |

### AUDIO-MIC-005: No Audio Input Detected

| Field | Value |
|-------|-------|
| **Code** | `AUDIO-MIC-005` |
| **Technical** | Audio level at zero for extended period despite active stream. |
| **Voice Message** | "I'm not hearing anything. Please check if your microphone is muted or if you've selected the right one." |
| **Recovery** | Show audio level indicator, suggest mic check |
| **Severity** | `WARNING` |

### AUDIO-SPK-001: Audio Output Failed

| Field | Value |
|-------|-------|
| **Code** | `AUDIO-SPK-001` |
| **Technical** | AudioContext playback failed or speaker unavailable. |
| **Voice Message** | *(Cannot speak - show visual)* "Audio playback issue. Check your speaker settings." |
| **Recovery** | Visual notification, text transcript fallback |
| **Severity** | `ERROR` |

### AUDIO-SPK-002: Audio Context Suspended

| Field | Value |
|-------|-------|
| **Code** | `AUDIO-SPK-002` |
| **Technical** | AudioContext in suspended state due to autoplay policy. |
| **Voice Message** | *(Show visual)* "Tap anywhere to enable audio." |
| **Recovery** | Require user interaction to resume AudioContext |
| **Severity** | `WARNING` |

### AUDIO-CODEC-001: Unsupported Audio Format

| Field | Value |
|-------|-------|
| **Code** | `AUDIO-CODEC-001` |
| **Technical** | Browser doesn't support required audio codec (e.g., PCM16, Opus). |
| **Voice Message** | "Your browser doesn't support the audio format we need. Please try a different browser." |
| **Recovery** | Suggest Chrome/Firefox/Edge, check for codec availability |
| **Severity** | `CRITICAL` |

### AUDIO-QUALITY-001: Poor Audio Quality

| Field | Value |
|-------|-------|
| **Code** | `AUDIO-QUALITY-001` |
| **Technical** | High packet loss, jitter, or noise detected in audio stream. |
| **Voice Message** | "I'm having trouble hearing you clearly. Could you speak a bit louder or move closer to the microphone?" |
| **Recovery** | Adjust noise suppression, request repeat |
| **Severity** | `INFO` |

### AUDIO-STREAM-001: Audio Stream Interrupted

| Field | Value |
|-------|-------|
| **Code** | `AUDIO-STREAM-001` |
| **Technical** | MediaStream ended unexpectedly or track became muted. |
| **Voice Message** | "I lost the audio connection. Let me restart it." |
| **Recovery** | Re-acquire media stream, restore conversation context |
| **Severity** | `WARNING` |

---

## 3. Tool Errors (TOOL)

### TOOL-EXEC-001: Tool Execution Failed

| Field | Value |
|-------|-------|
| **Code** | `TOOL-EXEC-001` |
| **Technical** | Tool function threw an exception or returned error status. |
| **Voice Message** | "I ran into a problem doing that. Let me try a different approach." |
| **Recovery** | Log error, attempt alternative method or graceful degradation |
| **Severity** | `ERROR` |

### TOOL-EXEC-002: Tool Execution Timeout

| Field | Value |
|-------|-------|
| **Code** | `TOOL-EXEC-002` |
| **Technical** | Tool execution exceeded maximum allowed time (default: 30s). |
| **Voice Message** | "That's taking too long. Let me try something simpler." |
| **Recovery** | Cancel operation, suggest breaking into smaller steps |
| **Severity** | `WARNING` |

### TOOL-EXEC-003: Tool Not Found

| Field | Value |
|-------|-------|
| **Code** | `TOOL-EXEC-003` |
| **Technical** | Requested tool name not registered in tool registry. |
| **Voice Message** | "I don't have the ability to do that right now." |
| **Recovery** | Log for debugging, suggest alternative actions |
| **Severity** | `ERROR` |

### TOOL-EXEC-004: Tool Permission Denied

| Field | Value |
|-------|-------|
| **Code** | `TOOL-EXEC-004` |
| **Technical** | Tool execution blocked by security policy or user permissions. |
| **Voice Message** | "I don't have permission to do that. You may need to grant additional access." |
| **Recovery** | Explain required permissions, offer alternative |
| **Severity** | `ERROR` |

### TOOL-PARSE-001: Invalid Tool Arguments

| Field | Value |
|-------|-------|
| **Code** | `TOOL-PARSE-001` |
| **Technical** | Tool arguments failed schema validation or type checking. |
| **Voice Message** | "I didn't quite understand what you need. Could you rephrase that?" |
| **Recovery** | Request clarification, show example if applicable |
| **Severity** | `WARNING` |

### TOOL-PARSE-002: Missing Required Arguments

| Field | Value |
|-------|-------|
| **Code** | `TOOL-PARSE-002` |
| **Technical** | Required tool parameters not provided in function call. |
| **Voice Message** | "I need a bit more information to do that. [Specific ask based on missing param]" |
| **Recovery** | Prompt for missing information |
| **Severity** | `INFO` |

### TOOL-RESULT-001: Tool Result Too Large

| Field | Value |
|-------|-------|
| **Code** | `TOOL-RESULT-001` |
| **Technical** | Tool output exceeds maximum size limit (e.g., >100KB). |
| **Voice Message** | "That returned a lot of information. Let me summarize the key points." |
| **Recovery** | Truncate intelligently, summarize, or paginate |
| **Severity** | `INFO` |

### TOOL-RESULT-002: Tool Result Parse Error

| Field | Value |
|-------|-------|
| **Code** | `TOOL-RESULT-002` |
| **Technical** | Tool returned malformed response (invalid JSON, unexpected format). |
| **Voice Message** | "Something went wrong processing that result. Let me try again." |
| **Recovery** | Retry once, log for debugging |
| **Severity** | `WARNING` |

### TOOL-LIMIT-001: Tool Rate Limited

| Field | Value |
|-------|-------|
| **Code** | `TOOL-LIMIT-001` |
| **Technical** | Tool execution blocked by rate limiter (too many calls). |
| **Voice Message** | "I need to slow down a bit. Give me a moment." |
| **Recovery** | Queue request, execute after cooldown period |
| **Severity** | `WARNING` |

### TOOL-LIMIT-002: Tool Quota Exceeded

| Field | Value |
|-------|-------|
| **Code** | `TOOL-LIMIT-002` |
| **Technical** | Usage quota for tool/API exhausted (daily/monthly limit). |
| **Voice Message** | "I've reached my limit for that feature today. This will reset tomorrow." |
| **Recovery** | Suggest alternative, notify about quota reset |
| **Severity** | `ERROR` |

---

## 4. Amplifier Errors (AMP)

### AMP-CONN-001: Amplifier Connection Failed

| Field | Value |
|-------|-------|
| **Code** | `AMP-CONN-001` |
| **Technical** | Failed to establish connection to Amplifier backend service. |
| **Voice Message** | "I can't connect to my assistant tools right now. I can still chat, but some features won't work." |
| **Recovery** | Retry connection, operate in degraded mode |
| **Severity** | `ERROR` |

### AMP-CONN-002: Amplifier Connection Lost

| Field | Value |
|-------|-------|
| **Code** | `AMP-CONN-002` |
| **Technical** | Existing Amplifier connection dropped unexpectedly. |
| **Voice Message** | "I lost connection to my tools. Reconnecting..." |
| **Recovery** | Auto-reconnect, queue pending operations |
| **Severity** | `WARNING` |

### AMP-TASK-001: Amplifier Task Failed

| Field | Value |
|-------|-------|
| **Code** | `AMP-TASK-001` |
| **Technical** | Amplifier agent task returned error or failed to complete. |
| **Voice Message** | "I couldn't complete that task. Would you like me to try again or do something else?" |
| **Recovery** | Offer retry or alternative approach |
| **Severity** | `ERROR` |

### AMP-TASK-002: Amplifier Task Timeout

| Field | Value |
|-------|-------|
| **Code** | `AMP-TASK-002` |
| **Technical** | Amplifier task exceeded maximum execution time. |
| **Voice Message** | "That task is taking longer than expected. It's still running in the background. I'll let you know when it's done." |
| **Recovery** | Continue background execution, send notification on completion |
| **Severity** | `INFO` |

### AMP-TASK-003: Amplifier Task Cancelled

| Field | Value |
|-------|-------|
| **Code** | `AMP-TASK-003` |
| **Technical** | Task was cancelled by user or system. |
| **Voice Message** | "Okay, I've stopped that task." |
| **Recovery** | Clean up resources, confirm cancellation |
| **Severity** | `INFO` |

### AMP-AGENT-001: Agent Not Available

| Field | Value |
|-------|-------|
| **Code** | `AMP-AGENT-001` |
| **Technical** | Requested Amplifier agent not found or not loaded. |
| **Voice Message** | "I don't have access to that specialist right now. Let me see what I can do myself." |
| **Recovery** | Fall back to default agent capabilities |
| **Severity** | `WARNING` |

### AMP-AGENT-002: Agent Busy

| Field | Value |
|-------|-------|
| **Code** | `AMP-AGENT-002` |
| **Technical** | Agent is processing another request and cannot accept new tasks. |
| **Voice Message** | "I'm still working on the previous task. I'll get to this next." |
| **Recovery** | Queue request, provide progress updates |
| **Severity** | `INFO` |

### AMP-CONTEXT-001: Context Size Exceeded

| Field | Value |
|-------|-------|
| **Code** | `AMP-CONTEXT-001` |
| **Technical** | Conversation context exceeds Amplifier's token limit. |
| **Voice Message** | "We've covered a lot of ground. I'll remember the key points, but some earlier details might fade." |
| **Recovery** | Summarize and compress context, preserve essential information |
| **Severity** | `INFO` |

### AMP-FILE-001: File Access Failed

| Field | Value |
|-------|-------|
| **Code** | `AMP-FILE-001` |
| **Technical** | Amplifier failed to read or write file (permission, not found, etc.). |
| **Voice Message** | "I couldn't access that file. Please check if it exists and I have permission to use it." |
| **Recovery** | Request correct path or permissions |
| **Severity** | `ERROR` |

### AMP-FILE-002: File Too Large

| Field | Value |
|-------|-------|
| **Code** | `AMP-FILE-002` |
| **Technical** | File exceeds maximum size limit for processing. |
| **Voice Message** | "That file is too large for me to process all at once. Can you point me to a specific part?" |
| **Recovery** | Suggest chunking or specific section |
| **Severity** | `WARNING` |

### AMP-APPROVAL-001: User Approval Required

| Field | Value |
|-------|-------|
| **Code** | `AMP-APPROVAL-001` |
| **Technical** | Operation requires explicit user confirmation before proceeding. |
| **Voice Message** | "Before I [action], I need your okay. Should I go ahead?" |
| **Recovery** | Wait for user confirmation, timeout after reasonable period |
| **Severity** | `INFO` |

### AMP-APPROVAL-002: User Approval Denied

| Field | Value |
|-------|-------|
| **Code** | `AMP-APPROVAL-002` |
| **Technical** | User explicitly denied approval for requested operation. |
| **Voice Message** | "No problem. Let me know if you'd like to do something else instead." |
| **Recovery** | Offer alternatives, do not retry same action |
| **Severity** | `INFO` |

---

## 5. Session Errors (SESSION)

### SESSION-CREATE-001: Session Creation Failed

| Field | Value |
|-------|-------|
| **Code** | `SESSION-CREATE-001` |
| **Technical** | Failed to create new session with voice API. |
| **Voice Message** | "I'm having trouble starting up. Please refresh and try again." |
| **Recovery** | Retry session creation, clear local state if corrupted |
| **Severity** | `CRITICAL` |

### SESSION-RESTORE-001: Session Restore Failed

| Field | Value |
|-------|-------|
| **Code** | `SESSION-RESTORE-001` |
| **Technical** | Failed to restore previous session state. |
| **Voice Message** | "I couldn't restore our previous conversation. Let's start fresh." |
| **Recovery** | Create new session, preserve what context is available |
| **Severity** | `WARNING` |

### SESSION-EXPIRED-001: Session Expired

| Field | Value |
|-------|-------|
| **Code** | `SESSION-EXPIRED-001` |
| **Technical** | Session timed out due to inactivity or server-side expiration. |
| **Voice Message** | "It's been a while. Let me reconnect... I'm ready when you are." |
| **Recovery** | Create new session, restore context if available |
| **Severity** | `INFO` |

### SESSION-INVALID-001: Invalid Session

| Field | Value |
|-------|-------|
| **Code** | `SESSION-INVALID-001` |
| **Technical** | Session ID not recognized by server (deleted, corrupted, wrong environment). |
| **Voice Message** | "I need to restart our connection. One moment..." |
| **Recovery** | Clear local session data, create fresh session |
| **Severity** | `WARNING` |

### SESSION-LIMIT-001: Session Limit Reached

| Field | Value |
|-------|-------|
| **Code** | `SESSION-LIMIT-001` |
| **Technical** | Maximum concurrent sessions exceeded for user/organization. |
| **Voice Message** | "You have too many active sessions. Please close one of your other conversations." |
| **Recovery** | Show active sessions, allow user to close others |
| **Severity** | `ERROR` |

### SESSION-STATE-001: State Sync Failed

| Field | Value |
|-------|-------|
| **Code** | `SESSION-STATE-001` |
| **Technical** | Client and server state became inconsistent. |
| **Voice Message** | "I got a bit confused. Let me reset... Okay, what would you like to do?" |
| **Recovery** | Re-sync state from server, clear local cache |
| **Severity** | `WARNING` |

### SESSION-CONTEXT-001: Context Load Failed

| Field | Value |
|-------|-------|
| **Code** | `SESSION-CONTEXT-001` |
| **Technical** | Failed to load conversation context or history. |
| **Voice Message** | "I couldn't load our conversation history. I might not remember everything we discussed." |
| **Recovery** | Continue without history, attempt background recovery |
| **Severity** | `WARNING` |

### SESSION-PERSIST-001: State Persistence Failed

| Field | Value |
|-------|-------|
| **Code** | `SESSION-PERSIST-001` |
| **Technical** | Failed to save session state (localStorage full, write error). |
| **Voice Message** | *(No voice - visual only)* "Unable to save session. Changes may be lost if you close this tab." |
| **Recovery** | Warn user, attempt alternative storage |
| **Severity** | `WARNING` |

---

## 6. Authentication Errors (AUTH)

### AUTH-TOKEN-001: Authentication Required

| Field | Value |
|-------|-------|
| **Code** | `AUTH-TOKEN-001` |
| **Technical** | Request requires authentication but no valid token provided. |
| **Voice Message** | "You'll need to sign in to continue. I'll wait while you do that." |
| **Recovery** | Redirect to login, preserve intended action |
| **Severity** | `ERROR` |

### AUTH-TOKEN-002: Token Expired

| Field | Value |
|-------|-------|
| **Code** | `AUTH-TOKEN-002` |
| **Technical** | Authentication token has expired (JWT exp claim, session timeout). |
| **Voice Message** | "Your session has expired. Please sign in again." |
| **Recovery** | Attempt silent refresh, fall back to re-authentication |
| **Severity** | `WARNING` |

### AUTH-TOKEN-003: Token Refresh Failed

| Field | Value |
|-------|-------|
| **Code** | `AUTH-TOKEN-003` |
| **Technical** | Failed to refresh authentication token. |
| **Voice Message** | "I couldn't refresh your login. You may need to sign in again." |
| **Recovery** | Redirect to full login flow |
| **Severity** | `ERROR` |

### AUTH-TOKEN-004: Token Invalid

| Field | Value |
|-------|-------|
| **Code** | `AUTH-TOKEN-004` |
| **Technical** | Token signature invalid or token malformed. |
| **Voice Message** | "There's an issue with your login. Please sign in again." |
| **Recovery** | Clear stored tokens, redirect to login |
| **Severity** | `ERROR` |

### AUTH-PERM-001: Insufficient Permissions

| Field | Value |
|-------|-------|
| **Code** | `AUTH-PERM-001` |
| **Technical** | User authenticated but lacks required permissions for action. |
| **Voice Message** | "You don't have permission to do that. You may need to contact your administrator." |
| **Recovery** | Explain what permission is needed, suggest alternatives |
| **Severity** | `ERROR` |

### AUTH-PERM-002: Feature Not Enabled

| Field | Value |
|-------|-------|
| **Code** | `AUTH-PERM-002` |
| **Technical** | Feature disabled for user's plan/tier. |
| **Voice Message** | "That feature isn't available on your current plan." |
| **Recovery** | Suggest upgrade or alternative |
| **Severity** | `INFO` |

### AUTH-API-001: API Key Invalid

| Field | Value |
|-------|-------|
| **Code** | `AUTH-API-001` |
| **Technical** | API key not recognized or revoked. |
| **Voice Message** | "There's a configuration problem. Please contact support." |
| **Recovery** | Log error for investigation, show support contact |
| **Severity** | `CRITICAL` |

### AUTH-API-002: API Key Rate Limited

| Field | Value |
|-------|-------|
| **Code** | `AUTH-API-002` |
| **Technical** | API key has exceeded rate limits. |
| **Voice Message** | "We're experiencing high demand. Please wait a moment and try again." |
| **Recovery** | Implement backoff, queue requests |
| **Severity** | `WARNING` |

### AUTH-OAUTH-001: OAuth Flow Failed

| Field | Value |
|-------|-------|
| **Code** | `AUTH-OAUTH-001` |
| **Technical** | OAuth authentication flow failed or was cancelled. |
| **Voice Message** | "Sign-in didn't complete. Would you like to try again?" |
| **Recovery** | Offer retry, show alternative sign-in methods |
| **Severity** | `ERROR` |

### AUTH-OAUTH-002: OAuth Provider Error

| Field | Value |
|-------|-------|
| **Code** | `AUTH-OAUTH-002` |
| **Technical** | OAuth provider returned error (Google, GitHub, etc. service issue). |
| **Voice Message** | "The sign-in service is having issues. Please try again in a few minutes." |
| **Recovery** | Retry with backoff, offer alternative providers |
| **Severity** | `ERROR` |

---

## Error Handling Implementation

### Error Object Structure

```typescript
interface VoiceError {
  code: string;              // e.g., "CONN-WS-001"
  category: ErrorCategory;   // Connection, Audio, Tool, Amplifier, Session, Auth
  severity: Severity;        // CRITICAL, ERROR, WARNING, INFO
  
  technical: {
    message: string;         // Detailed technical description
    stack?: string;          // Stack trace if available
    context?: object;        // Additional debugging info
  };
  
  voice: {
    message: string;         // Voice-friendly message
    followUp?: string;       // Message after recovery attempt
    action?: string;         // Suggested action
  };
  
  recovery: {
    strategy: string;        // Auto-retry, user-action, graceful-degradation
    maxRetries?: number;     // For auto-retry strategies
    retryDelay?: number;     // Initial retry delay in ms
    fallback?: () => void;   // Fallback action
  };
  
  timestamp: Date;
  sessionId?: string;
}
```

### Error Handler Flow

```
┌─────────────────┐
│  Error Occurs   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Classify Error  │──── Map to error code
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Log Technical   │──── Full details for debugging
│    Details      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Check Severity  │────▶│ CRITICAL/ERROR  │
└────────┬────────┘     │ Speak + Visual  │
         │              └─────────────────┘
         ▼
┌─────────────────┐     ┌─────────────────┐
│ WARNING/INFO    │────▶│ Speak briefly   │
│                 │     │ or visual only  │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Execute Recovery│──── Retry, fallback, etc.
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Recovery OK?    │─No─▶│ Escalate/Notify │
└────────┬────────┘     └─────────────────┘
         │Yes
         ▼
┌─────────────────┐
│ Speak Follow-up │──── "I'm back. Where were we?"
└─────────────────┘
```

### Voice Queue for Errors

Errors should respect the conversation flow:

1. **Don't interrupt mid-sentence** - Queue error message
2. **Batch related errors** - "I'm having a few connection issues" (not 5 separate messages)
3. **Suppress repeated errors** - Same error within 30s = suppress voice, update visual only
4. **Priority queue** - CRITICAL errors can interrupt, others wait

---

## Error Message Localization

### Template Structure

```yaml
CONN-WS-001:
  en-US: "I'm having trouble connecting right now. Let me try again."
  en-GB: "I'm having trouble connecting at the moment. Let me try again."
  es-ES: "Estoy teniendo problemas para conectarme. Déjame intentarlo de nuevo."
  fr-FR: "J'ai du mal à me connecter. Laissez-moi réessayer."
  de-DE: "Ich habe gerade Verbindungsprobleme. Ich versuche es noch einmal."
  ja-JP: "接続に問題があります。もう一度試させてください。"
```

### Voice Characteristics by Severity

| Severity | Tone | Pace | Volume |
|----------|------|------|--------|
| CRITICAL | Calm but serious | Slightly slower | Normal |
| ERROR | Apologetic | Normal | Normal |
| WARNING | Casual | Normal | Slightly softer |
| INFO | Light | Normal | Softer |

---

## Testing Error Messages

### Voice Message Checklist

For each error message, verify:

- [ ] **Understandable** - Non-technical user can understand
- [ ] **Actionable** - User knows what to do (or that nothing is needed)
- [ ] **Appropriate length** - 2-15 words ideal, max 25 words
- [ ] **No jargon** - No "WebSocket", "token", "API", etc.
- [ ] **No blame** - Never implies user did something wrong (unless they did)
- [ ] **Consistent voice** - Matches assistant personality
- [ ] **TTS friendly** - No abbreviations, symbols that sound wrong

### User Testing Scenarios

1. Play error message without context - can user guess what happened?
2. Play error message - does user know what to do next?
3. Play in noisy environment - is it still clear?
4. Play sequence of errors - do they flow naturally?

---

## Quick Reference Card

### Most Common Errors

| Situation | Code | Voice Message |
|-----------|------|---------------|
| Lost connection | CONN-WS-002 | "Connection lost. Reconnecting..." |
| No microphone | AUDIO-MIC-002 | "I can't find a microphone. Please connect one..." |
| Mic permission | AUDIO-MIC-001 | "I need microphone access to hear you..." |
| Tool failed | TOOL-EXEC-001 | "I ran into a problem doing that. Let me try a different approach." |
| Amplifier down | AMP-CONN-001 | "I can't connect to my assistant tools right now..." |
| Session expired | SESSION-EXPIRED-001 | "It's been a while. Let me reconnect..." |
| Need login | AUTH-TOKEN-001 | "You'll need to sign in to continue..." |
| No permission | AUTH-PERM-001 | "You don't have permission to do that..." |

### Recovery Phrases

| After... | Say... |
|----------|--------|
| Reconnection | "I'm back. Where were we?" |
| Retry success | "Okay, that worked." |
| Long operation | "Done. Here's what I found..." |
| User retry | "Let's try that again." |
| Graceful degradation | "I'll work around that." |

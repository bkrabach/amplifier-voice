# Voice + Amplifier System Testing Checklist

> **Purpose**: Comprehensive test scenarios for validating the voice-controlled Amplifier system
> **Coverage**: Connection, audio, conversation, tools, Amplifier integration, sessions, edge cases, E2E, performance, accessibility

---

## Quick Reference: Test Priority Matrix

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Connection | WebRTC setup, reconnection | Fallback modes | ICE negotiation | TURN server |
| Audio | Mic access, VAD | Echo cancellation | Noise handling | Quality metrics |
| Conversation | Turn-taking, interruption | Context retention | Multi-turn | Corrections |
| Tools | Execution, timeout | Error handling | Parallel calls | Cancellation |
| Amplifier | Delegation, results | Async tasks | Progress updates | State sync |
| Session | Timeout handling | State preservation | Recovery | Multi-session |
| Edge Cases | Silence, noise | Rapid speech | Multiple speakers | Ambiguity |
| Integration | Happy path E2E | Error flows | Multi-step | Complex scenarios |
| Performance | TTFA latency | Memory usage | Concurrent load | Sustained load |
| Accessibility | Screen reader | Captions | Keyboard nav | Visual indicators |

---

## 1. Connection Tests

### 1.1 WebRTC Setup

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| CON-001 | Initial WebRTC connection | 1. Load app 2. Click "Start Voice" 3. Grant permissions | WebRTC connection established, audio streaming begins | Critical |
| CON-002 | SDP offer/answer exchange | 1. Monitor network 2. Initiate connection | Client offer sent, server answer received, ICE candidates exchanged | Critical |
| CON-003 | ICE candidate gathering | 1. Connect on restricted network 2. Monitor ICE state | All ICE candidates gathered, connection established | High |
| CON-004 | STUN server connectivity | 1. Connect with STUN only 2. Verify peer connection | Connection via STUN succeeds on permissive networks | Medium |
| CON-005 | TURN server fallback | 1. Block direct UDP 2. Attempt connection | Falls back to TURN relay, connection succeeds | Medium |
| CON-006 | Connection timeout handling | 1. Simulate slow network 2. Attempt connection | Timeout after 30s with user-friendly message | High |
| CON-007 | Invalid session token | 1. Use expired/invalid token 2. Attempt connection | Clear error message, prompt to retry | High |

### 1.2 Fallback Mechanisms

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| CON-010 | WebRTC to WebSocket fallback | 1. Block WebRTC 2. Attempt voice session | Falls back to WebSocket mode (if implemented) | Medium |
| CON-011 | Voice to text fallback | 1. Deny microphone permission 2. Continue session | Text input mode activated, session continues | High |
| CON-012 | Audio output fallback | 1. No audio output device 2. Receive response | Response displayed as text/captions | High |
| CON-013 | Degraded mode notification | 1. Trigger any fallback mode | User informed of reduced capabilities | Medium |

### 1.3 Reconnection

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| CON-020 | Network disconnect recovery | 1. Establish connection 2. Disconnect network 3. Reconnect | Automatic reconnection within 5s, context preserved | Critical |
| CON-021 | Exponential backoff | 1. Disconnect 2. Block reconnection 3. Monitor retries | Retries at 1s, 2s, 4s, 8s intervals, max 30s | High |
| CON-022 | Max retry exceeded | 1. Block connection for >2 min | Clear error message, manual retry button shown | High |
| CON-023 | WiFi to cellular handoff | 1. Connect on WiFi 2. Switch to cellular | Seamless reconnection, conversation continues | Medium |
| CON-024 | Reconnection during task | 1. Start Amplifier task 2. Disconnect 3. Reconnect | Task status retrieved, user updated on progress | High |
| CON-025 | Browser tab sleep/wake | 1. Start session 2. Switch tabs for 5 min 3. Return | Session reconnects or recovers gracefully | Medium |
| CON-026 | Laptop sleep/wake | 1. Start session 2. Close laptop 3. Reopen | Session recovery or clean restart | Medium |

---

## 2. Audio Tests

### 2.1 Microphone Access

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| AUD-001 | Microphone permission grant | 1. Load app (fresh) 2. Request permission 3. Grant | Microphone activated, audio level indicator shows input | Critical |
| AUD-002 | Microphone permission deny | 1. Load app 2. Deny permission | Clear message explaining need, text fallback offered | Critical |
| AUD-003 | Microphone permission revoked | 1. Grant permission 2. Revoke in browser settings | Detect revocation, prompt to re-enable | High |
| AUD-004 | Multiple microphone devices | 1. Connect multiple mics 2. Test device selection | User can select preferred device | Medium |
| AUD-005 | Microphone disconnected mid-session | 1. Start session 2. Unplug microphone | Detect disconnect, prompt to reconnect or use text | High |
| AUD-006 | Bluetooth microphone | 1. Connect Bluetooth headset 2. Start session | Audio captured correctly, no additional latency | Medium |
| AUD-007 | System microphone muted | 1. Mute system mic 2. Attempt voice input | Detect muted state, show visual indicator | Medium |

### 2.2 Echo Cancellation

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| AUD-010 | Built-in echo cancellation | 1. Use speakers (no headphones) 2. Converse | AI response not re-captured as user input | Critical |
| AUD-011 | Echo detection | 1. Disable AEC 2. Play response through speakers | System detects echo, suggests headphones | High |
| AUD-012 | Self-echo filtering | 1. Speak while AI responds 2. Check transcript | User speech captured, AI audio filtered out | High |
| AUD-013 | Room reverb handling | 1. Test in echoey room 2. Normal conversation | Echo cancellation handles reverb | Medium |

### 2.3 Noise Handling

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| AUD-020 | Background conversation | 1. Add background voices (TV, radio) 2. Speak | User speech isolated, background ignored | High |
| AUD-021 | Keyboard typing noise | 1. Type while speaking 2. Check transcription | Typing noise filtered, speech captured | Medium |
| AUD-022 | Environmental noise (cafe) | 1. Play cafe ambient noise at 15dB SNR 2. Speak | Speech recognized with <15% WER increase | High |
| AUD-023 | Traffic/outdoor noise | 1. Play traffic noise at 10dB SNR 2. Speak | Speech recognized or clarification requested | Medium |
| AUD-024 | Sudden loud noise | 1. Mid-utterance, play loud noise 2. Continue | Graceful handling, request to repeat if needed | Medium |
| AUD-025 | Continuous fan/AC noise | 1. Add steady 40dB background noise 2. Converse | Noise profile learned, speech extracted | Medium |
| AUD-026 | Notification sounds | 1. Trigger system notifications during session | Notifications filtered, not interpreted as speech | Low |

### 2.4 Audio Quality

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| AUD-030 | Audio input quality check | 1. Start session 2. Measure input SNR | SNR >25dB for clear environments | Medium |
| AUD-031 | Audio output quality | 1. Receive AI response 2. Measure MOS | MOS >3.5 (Good quality) | Medium |
| AUD-032 | No audio clipping | 1. Speak loudly 2. Check waveform | Max amplitude <0.99, no distortion | Medium |
| AUD-033 | Sample rate handling | 1. Test with 24kHz input 2. Test with 16kHz | Both sample rates handled correctly | Low |
| AUD-034 | Codec quality | 1. Measure Opus codec performance | Audio quality maintained across encoding | Low |
| AUD-035 | Low bandwidth audio | 1. Throttle to 50kbps 2. Converse | Degraded but usable audio quality | Medium |

---

## 3. Conversation Tests

### 3.1 Turn-Taking

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| CONV-001 | Basic turn exchange | 1. User speaks 2. AI responds 3. User speaks | Clean turn alternation, no overlap | Critical |
| CONV-002 | VAD end-of-turn detection | 1. Speak with natural pauses 2. Stop speaking | AI responds after appropriate silence (500-1000ms) | Critical |
| CONV-003 | Long user utterance | 1. Speak for 30 seconds continuously | Full utterance captured, processed correctly | High |
| CONV-004 | Short user utterance | 1. Say single word like "Yes" | Recognized and processed without timeout | High |
| CONV-005 | User hesitation/filler words | 1. Say "um", "uh", pause, continue | Fillers handled, complete thought captured | Medium |
| CONV-006 | Premature AI response | 1. Pause mid-sentence (2s) 2. Continue | AI either waits or gracefully handles continuation | High |
| CONV-007 | Natural conversation pace | 1. Have 5-turn conversation at normal pace | Latency feels natural (<2s TTFA) | High |

### 3.2 Interruption Handling

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| CONV-010 | Mid-response interruption | 1. Ask question 2. AI starts responding 3. Interrupt | AI stops immediately (<200ms), listens to user | Critical |
| CONV-011 | Interruption context preserved | 1. Interrupt AI 2. Give new instruction | AI acknowledges interrupt, follows new instruction | Critical |
| CONV-012 | "Stop" command | 1. AI responding 2. Say "stop" | Audio stops, AI awaits new input | High |
| CONV-013 | "Wait" command | 1. AI responding 2. Say "wait" | AI pauses, can resume or redirect | High |
| CONV-014 | "Actually..." correction | 1. AI starts task 2. Say "Actually, I meant..." | AI stops, processes correction | High |
| CONV-015 | Rapid interruption recovery | 1. Interrupt 3 times in 10 seconds | System remains responsive, no degradation | Medium |
| CONV-016 | Audio truncation accuracy | 1. Interrupt mid-response 2. Check audio state | Unheard audio properly truncated from context | High |

### 3.3 Context Retention

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| CONV-020 | Reference previous turn | 1. "What's in auth.py?" 2. "Can you fix line 42?" | AI understands "line 42" refers to auth.py | Critical |
| CONV-021 | Multi-turn context | 1. Have 10-turn conversation about one topic | Context maintained throughout | Critical |
| CONV-022 | Pronoun resolution | 1. "Look at UserService" 2. "What does it do?" | "it" correctly resolves to UserService | High |
| CONV-023 | File context retention | 1. Read file 2. Ask about its contents 5 turns later | File content still accessible in context | High |
| CONV-024 | Task context retention | 1. Complete task 2. Ask about results 3 turns later | Task results accessible | High |
| CONV-025 | Context with topic change | 1. Discuss file A 2. Discuss file B 3. "Go back to the first file" | Correctly returns to file A context | Medium |
| CONV-026 | Long session context | 1. Converse for 30 minutes 2. Reference early topic | Earlier context accessible or summarized | Medium |

### 3.4 Multi-Turn Conversations

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| CONV-030 | Complete workflow | 1. "Find bugs" 2. "Fix the critical one" 3. "Now test it" | Each step builds on previous, workflow completes | High |
| CONV-031 | Clarification flow | 1. Ambiguous request 2. AI asks clarification 3. User clarifies | Clarification used, task proceeds | High |
| CONV-032 | Iterative refinement | 1. "Create function" 2. "Make it async" 3. "Add error handling" | Each iteration builds on previous | High |
| CONV-033 | Topic switch and return | 1. Discuss A 2. Switch to B 3. "Back to what we were doing before" | Returns to topic A with context | Medium |
| CONV-034 | Parallel topics | 1. "Remember I need to fix auth" 2. Work on other task 3. "Now the auth thing" | Both topics tracked | Medium |

---

## 4. Tool Tests

### 4.1 Tool Execution (Each Tool Type)

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| TOOL-001 | read_file execution | 1. "Read src/main.py" | File contents returned, summarized for voice | Critical |
| TOOL-002 | write_file execution | 1. "Create a new file test.py with hello world" | File created, confirmation given | Critical |
| TOOL-003 | edit_file execution | 1. Read file 2. "Change function name to X" | Edit applied, change confirmed | Critical |
| TOOL-004 | bash execution | 1. "Run the tests" | Command executes, results reported | Critical |
| TOOL-005 | web_search execution | 1. "Search for Python async patterns" | Search results summarized vocally | High |
| TOOL-006 | web_fetch execution | 1. "Fetch the docs from [URL]" | Page content fetched, relevant parts summarized | High |
| TOOL-007 | grep execution | 1. "Find all TODO comments" | Results listed, count reported | High |
| TOOL-008 | glob execution | 1. "List all Python files" | File list returned, count reported | High |
| TOOL-009 | task delegation | 1. "Analyze this codebase for security issues" | Task delegated to Amplifier, progress reported | Critical |
| TOOL-010 | Multiple tool chain | 1. "Find the config file and update the timeout" | glob → read → edit executed in sequence | High |

### 4.2 Tool Timeouts

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| TOOL-020 | Fast tool timeout | 1. Execute read_file on huge file | Timeout after 30s, partial results if available | High |
| TOOL-021 | Long task timeout | 1. Start complex Amplifier task 2. Wait | Progress updates given, no premature timeout | High |
| TOOL-022 | Configurable timeout | 1. "This might take a while, analyze entire repo" | Extended timeout applied, user informed | Medium |
| TOOL-023 | Timeout with partial results | 1. Grep large codebase 2. Timeout occurs | Partial results returned with notice | Medium |
| TOOL-024 | User-initiated timeout | 1. Start long task 2. "Stop that, it's taking too long" | Task cancelled, partial results if any | High |

### 4.3 Tool Errors

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| TOOL-030 | File not found | 1. "Read nonexistent.py" | Clear error: "File not found. Did you mean...?" | Critical |
| TOOL-031 | Permission denied | 1. "Read /etc/shadow" | Clear error: "I don't have permission to access that" | Critical |
| TOOL-032 | Invalid arguments | 1. Provide malformed path | Clear error, suggest correction | High |
| TOOL-033 | Tool execution failure | 1. "Run broken_script.sh" | Error captured, reported with context | High |
| TOOL-034 | External service unavailable | 1. Web search when offline | "I can't reach the web right now" | High |
| TOOL-035 | Rate limit hit | 1. Rapid tool calls | Graceful slowdown, user informed | High |
| TOOL-036 | Recoverable error with retry | 1. Transient network error | Automatic retry (up to 3), then report | Medium |
| TOOL-037 | Dangerous command blocked | 1. "Run rm -rf /" | Blocked with explanation | Critical |

### 4.4 Tool Result Communication

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| TOOL-040 | Large result summarization | 1. Read 500-line file | Key sections summarized, offer detail | High |
| TOOL-041 | Structured result reading | 1. Search returns 20 results | "Found 20 results. Top 3 are..." | High |
| TOOL-042 | Code result formatting | 1. Tool returns code snippet | Code communicated clearly for voice | High |
| TOOL-043 | Error result communication | 1. Tool fails with stack trace | Human-friendly error explanation | High |
| TOOL-044 | Binary/non-text result | 1. Try to read image file | "That's a binary file. Can't display contents." | Medium |

---

## 5. Amplifier Tests

### 5.1 Task Delegation

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| AMP-001 | Simple task delegation | 1. "Analyze the auth module" | Task delegated, agent executes, results returned | Critical |
| AMP-002 | Complex multi-step task | 1. "Refactor UserService to use dependency injection" | Amplifier handles multi-step, voice summarizes | Critical |
| AMP-003 | Agent selection | 1. Request code review 2. Request security scan | Appropriate agent selected for each | High |
| AMP-004 | Task context passing | 1. Discuss file 2. "Fix that issue" | Amplifier receives conversation context | Critical |
| AMP-005 | Task with specific instructions | 1. "Use the factory pattern when refactoring" | Instructions passed to Amplifier accurately | High |
| AMP-006 | Task cancellation | 1. Start task 2. "Cancel that" | Task stopped, partial work available | High |
| AMP-007 | Task priority | 1. Start low-priority task 2. "Actually, urgent fix needed" | Priority handled appropriately | Medium |

### 5.2 Async Task Handling

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| AMP-010 | Background task | 1. "Run tests in background" | Task runs, voice session continues | High |
| AMP-011 | Task status query | 1. Start background task 2. "How's that task going?" | Current status reported | High |
| AMP-012 | Task completion notification | 1. Start async task 2. Complete | "The analysis is done. Found 3 issues." | High |
| AMP-013 | Multiple concurrent tasks | 1. Start task A 2. Start task B 3. Query status | Both tracked, status reported | Medium |
| AMP-014 | Task queue management | 1. Queue 5 tasks 2. Query queue | Queue status reported | Medium |
| AMP-015 | Long-running task (>5 min) | 1. Start complex refactor | Progress updates, no timeout | High |

### 5.3 Result Handling

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| AMP-020 | Successful result summary | 1. Task completes successfully | Results summarized appropriately for voice | Critical |
| AMP-021 | Large result handling | 1. Task returns 1000+ line diff | Key changes summarized, detail available | High |
| AMP-022 | Structured result parsing | 1. Task returns JSON/structured data | Data interpreted and communicated | High |
| AMP-023 | Partial success result | 1. Task partially completes | "Completed 8 of 10 items. 2 failed because..." | High |
| AMP-024 | Error result handling | 1. Task fails | Error explained, recovery suggested | Critical |
| AMP-025 | Result with user decision needed | 1. Task needs approval | "I found an issue. Should I fix it?" | High |
| AMP-026 | Result follow-up | 1. Task completes 2. "Tell me more about the third issue" | Can drill into specific results | Medium |

### 5.4 State Synchronization

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| AMP-030 | Voice-Amplifier context sync | 1. Voice session modifies file 2. Amplifier reads file | Amplifier sees latest state | Critical |
| AMP-031 | Amplifier-Voice result sync | 1. Amplifier modifies files 2. Voice asks about them | Voice aware of changes | Critical |
| AMP-032 | State after reconnection | 1. Disconnect during task 2. Reconnect | Task state correctly synchronized | High |
| AMP-033 | Concurrent modification detection | 1. Voice and Amplifier edit same file | Conflict detected, user consulted | Medium |
| AMP-034 | Session state persistence | 1. End voice session 2. New session | Relevant state available | Medium |

---

## 6. Session Tests

### 6.1 Session Timeout (15 min OpenAI limit)

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| SES-001 | Pre-timeout warning | 1. Session active for 13 minutes | "Our session will refresh in about 2 minutes" | Critical |
| SES-002 | Automatic session renewal | 1. Reach 14 minutes 2. Continue conversation | Seamless session renewal | Critical |
| SES-003 | Context preservation across renewal | 1. Discuss topic 2. Session renews 3. Continue topic | Context maintained | Critical |
| SES-004 | Active task during timeout | 1. Long Amplifier task running 2. Session timeout | Task continues, results available after renewal | High |
| SES-005 | User notification of renewal | 1. Session renews | Brief acknowledgment, no disruption | Medium |

### 6.2 State Preservation

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| SES-010 | Conversation state persistence | 1. 10-turn conversation 2. Reconnect | Conversation history available | Critical |
| SES-011 | Tool results preservation | 1. Run tools 2. Disconnect 3. Reconnect | Tool results still accessible | High |
| SES-012 | Active files preservation | 1. Work on files 2. Reconnect | Files still in context | High |
| SES-013 | User preferences persistence | 1. Set preference 2. New session | Preference remembered | Medium |
| SES-014 | Checkpoint creation | 1. Long session with multiple topics | Periodic checkpoints created | Medium |

### 6.3 Recovery Scenarios

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| SES-020 | Network disconnect recovery | 1. Disconnect 2. Reconnect within 1 min | Full context restored | Critical |
| SES-021 | Browser refresh recovery | 1. Refresh page mid-conversation | Session restored with context | High |
| SES-022 | Browser crash recovery | 1. Force quit browser 2. Reopen | Can resume or graceful restart | High |
| SES-023 | Recovery with active task | 1. Start task 2. Disconnect 3. Reconnect | Task status available, can resume | High |
| SES-024 | Recovery after long disconnect | 1. Disconnect for 10 minutes 2. Reconnect | Graceful restart with context summary | Medium |
| SES-025 | Orphan task recovery | 1. Start task 2. Close browser 3. Reopen | Orphan task detected, status available | Medium |

### 6.4 Multi-Session Scenarios

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| SES-030 | Multiple tabs | 1. Open second tab 2. Start session | Warning about existing session | High |
| SES-031 | Session takeover | 1. Session in tab A 2. Start session in tab B | Option to transfer session | Medium |
| SES-032 | Multiple devices | 1. Session on laptop 2. Try phone | Clear session management | Medium |
| SES-033 | Session isolation | 1. Two users, same server | Sessions completely isolated | Critical |

---

## 7. Edge Case Tests

### 7.1 Silence Handling

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| EDGE-001 | 10-second silence | 1. Start session 2. Say nothing for 10s | Gentle prompt: "I'm still here if you need me" | High |
| EDGE-002 | 30-second silence | 1. Start session 2. Say nothing for 30s | "Let me know when you're ready" | Medium |
| EDGE-003 | 60-second silence | 1. Start session 2. Say nothing for 60s | Low-power mode or "Are you still there?" | Medium |
| EDGE-004 | Silence mid-task | 1. Start multi-step request 2. Stop responding | AI prompts for continuation | High |
| EDGE-005 | Return from silence | 1. Be silent 30s 2. Speak | Immediate responsiveness, no re-connection needed | High |

### 7.2 Noise Edge Cases

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| EDGE-010 | Cough/sneeze | 1. Cough mid-sentence 2. Continue | Cough filtered, speech captured | Medium |
| EDGE-011 | Throat clearing | 1. Clear throat 2. Speak | Not interpreted as speech | Medium |
| EDGE-012 | Dog barking | 1. Play dog bark 2. Speak | Bark filtered, speech captured | Medium |
| EDGE-013 | Baby crying | 1. Play baby crying in background | Speech isolated or clarification requested | Medium |
| EDGE-014 | Music playing | 1. Play music at low volume 2. Speak | Speech captured through music | Medium |
| EDGE-015 | Doorbell/phone ring | 1. Play notification sound 2. Speak | Sound filtered, not interpreted | Low |

### 7.3 Rapid Speech / Complex Input

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| EDGE-020 | Very fast speech | 1. Speak 200+ WPM | Either captured or request to slow down | High |
| EDGE-021 | Multiple commands at once | 1. "Read the file, find the bug, and fix it" | All three commands parsed and executed | High |
| EDGE-022 | Stream of consciousness | 1. Long rambling request with corrections | Core intent extracted | Medium |
| EDGE-023 | Stuttering/repetition | 1. "Can you can you look at at at the file" | Understood as single request | Medium |
| EDGE-024 | Self-correction mid-utterance | 1. "Look at auth no wait user service" | Final intent (user service) used | High |
| EDGE-025 | Technical jargon rapid-fire | 1. Quickly list technical terms | Terms captured accurately | Medium |

### 7.4 Multiple Speakers

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| EDGE-030 | Background conversation | 1. Others talking in room 2. User speaks | User speech isolated | High |
| EDGE-031 | Speaker confusion | 1. Two people speak to system | "Were you talking to me?" or primary user identified | Medium |
| EDGE-032 | User talks to someone else | 1. User has side conversation | System waits or confirms address | Medium |
| EDGE-033 | Voice change detection | 1. Different person speaks | Note change, continue or verify | Low |

### 7.5 Ambiguous Input

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| EDGE-040 | Ambiguous file reference | 1. "Look at the config file" (multiple exist) | "Which config file? I see config.py and config.yaml" | High |
| EDGE-041 | Ambiguous pronoun | 1. Discuss A and B 2. "Fix it" | Clarify which one, or use most recent | High |
| EDGE-042 | Ambiguous action | 1. "Update the thing" | Ask for clarification | High |
| EDGE-043 | Contradictory request | 1. "Delete the file but keep the data" | Point out contradiction, ask for clarification | Medium |
| EDGE-044 | Impossible request | 1. "Run the server that doesn't exist" | "I don't see a server configuration. Would you like to create one?" | High |

### 7.6 Emotional/Frustration Handling

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| EDGE-050 | Repeated failure frustration | 1. Same request fails 3 times | Acknowledge frustration, try different approach | High |
| EDGE-051 | Explicit frustration | 1. "This is so frustrating!" | Empathetic response, offer alternatives | High |
| EDGE-052 | User giving up | 1. "Never mind, forget it" | Acknowledge, offer to help differently | Medium |
| EDGE-053 | Urgent tone | 1. "This is urgent! Fix it now!" | Prioritize appropriately | Medium |

---

## 8. Integration Tests (End-to-End)

### 8.1 Happy Path E2E

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| E2E-001 | Simple query | 1. "What files are in src?" | File list returned within 2s | Critical |
| E2E-002 | File read and discuss | 1. "Read main.py" 2. "What does the setup function do?" | File read, question answered | Critical |
| E2E-003 | Simple edit | 1. "Add a docstring to the main function" | Edit made, confirmed | Critical |
| E2E-004 | Search and navigate | 1. "Find where UserService is defined" 2. "Show me that file" | Found, displayed | Critical |
| E2E-005 | Run command | 1. "Run the tests" | Tests run, results summarized | Critical |

### 8.2 Error Recovery E2E

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| E2E-010 | File not found, then create | 1. "Read config.yaml" (missing) 2. "Create it with default values" | Error handled, file created | High |
| E2E-011 | Test failure, then fix | 1. "Run tests" (failures) 2. "Fix the failing test" | Failure reported, fix applied | High |
| E2E-012 | Permission error, alternative | 1. Try restricted operation 2. Suggest workaround | Error explained, alternative offered | High |
| E2E-013 | Network error, retry | 1. Web search (fails) 2. Automatic retry | Error recovered, results returned | High |

### 8.3 Multi-Step E2E

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| E2E-020 | Bug fix workflow | 1. "Find bugs in auth.py" 2. "Fix the critical one" 3. "Run tests" 4. "Commit it" | Complete workflow succeeds | High |
| E2E-021 | Feature addition | 1. "Add input validation to UserService" | Planning, implementation, testing | High |
| E2E-022 | Code review workflow | 1. "Review the recent changes" 2. "Apply suggested fixes" | Review, suggestions, fixes | High |
| E2E-023 | Refactoring workflow | 1. "Refactor this to use async" 2. "Make sure tests pass" 3. "Update docs" | Multi-phase refactor | Medium |

### 8.4 Complex Scenario E2E

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| E2E-030 | Full feature development | 1. "Add user authentication" | Planning → implement → test → docs | Medium |
| E2E-031 | Debug complex issue | 1. "The app crashes on startup" | Investigation → diagnosis → fix | Medium |
| E2E-032 | Code migration | 1. "Migrate from sync to async throughout" | Analysis → planning → incremental migration | Low |
| E2E-033 | Multi-file coordination | 1. "Split UserService into smaller services" | Analysis → refactor → update imports → test | Medium |

---

## 9. Performance Tests

### 9.1 Latency

| ID | Test Case | Measurement | Target | Priority |
|----|-----------|-------------|--------|----------|
| PERF-001 | Time to First Audio (TTFA) - P50 | End of user speech → start of AI audio | <1.5s | Critical |
| PERF-002 | Time to First Audio (TTFA) - P95 | End of user speech → start of AI audio | <5.0s | Critical |
| PERF-003 | Simple tool latency | Request → result for read_file | <1.0s | High |
| PERF-004 | Complex tool latency | Request → result for grep | <3.0s | High |
| PERF-005 | Amplifier delegation latency | Voice request → Amplifier starts | <2.0s | High |
| PERF-006 | Interruption response time | User interrupt → audio stops | <200ms | Critical |
| PERF-007 | Reconnection time | Disconnect → fully reconnected | <5.0s | High |
| PERF-008 | Session start time | Click start → ready to converse | <3.0s | High |

### 9.2 Resource Usage

| ID | Test Case | Measurement | Target | Priority |
|----|-----------|-------------|--------|----------|
| PERF-010 | Memory - idle session | Browser memory usage | <200MB | High |
| PERF-011 | Memory - active conversation | Browser memory during use | <500MB | High |
| PERF-012 | Memory - 30min session | Memory after extended use | <1GB, no leak | High |
| PERF-013 | CPU - idle | CPU usage when listening | <5% | Medium |
| PERF-014 | CPU - active | CPU during conversation | <30% | Medium |
| PERF-015 | Network - idle | Bandwidth when waiting | <10kbps | Medium |
| PERF-016 | Network - active | Bandwidth during speech | <100kbps | Medium |
| PERF-017 | Server memory | Backend memory per session | <100MB | High |
| PERF-018 | Server CPU | Backend CPU per session | Minimal impact | Medium |

### 9.3 Concurrent Load

| ID | Test Case | Measurement | Target | Priority |
|----|-----------|-------------|--------|----------|
| PERF-020 | 10 concurrent sessions | All sessions responsive | No degradation | High |
| PERF-021 | 50 concurrent sessions | System stability | <10% latency increase | Medium |
| PERF-022 | 100 concurrent sessions | System limits | Graceful degradation | Low |
| PERF-023 | Spike handling | 0→20 sessions in 30s | All sessions succeed | Medium |
| PERF-024 | Mixed load | Voice + Amplifier concurrent | Both functional | High |

### 9.4 Sustained Load

| ID | Test Case | Measurement | Target | Priority |
|----|-----------|-------------|--------|----------|
| PERF-030 | 1-hour session | Stability, no memory leak | Consistent performance | High |
| PERF-031 | 4-hour continuous use | System stability | No degradation | Medium |
| PERF-032 | High activity sustained | 100 requests/min for 30min | <5% error rate | Medium |
| PERF-033 | Recovery from load | After spike, return to normal | Full recovery in <1min | Medium |

---

## 10. Accessibility Tests

### 10.1 Screen Reader Compatibility

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| ACC-001 | VoiceOver (macOS) | 1. Enable VoiceOver 2. Navigate app | All controls announced | High |
| ACC-002 | NVDA (Windows) | 1. Enable NVDA 2. Navigate app | All controls announced | High |
| ACC-003 | Focus management | 1. Tab through interface | Logical focus order | High |
| ACC-004 | Live regions | 1. Receive AI response | Response announced automatically | High |
| ACC-005 | Button labels | 1. Navigate to buttons | Clear, descriptive labels | High |
| ACC-006 | Status announcements | 1. Connection changes | Status changes announced | Medium |
| ACC-007 | Error announcements | 1. Trigger error | Error announced with description | High |

### 10.2 Captions/Transcription

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| ACC-010 | User speech captions | 1. Speak 2. Check transcript | User speech shown in real-time | Critical |
| ACC-011 | AI response captions | 1. AI responds 2. Check transcript | AI speech transcribed accurately | Critical |
| ACC-012 | Caption timing | 1. Monitor caption sync | Captions sync with audio (<500ms) | High |
| ACC-013 | Caption persistence | 1. Scroll through conversation | Full transcript available | High |
| ACC-014 | Caption styling | 1. Check contrast, size | Meets WCAG AA (4.5:1 contrast) | High |
| ACC-015 | Caption-only mode | 1. Disable audio output | Can use with captions only | High |

### 10.3 Keyboard Navigation

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| ACC-020 | Start session (keyboard) | 1. Tab to start 2. Press Enter | Session starts | High |
| ACC-021 | Stop session (keyboard) | 1. Press Escape or designated key | Session stops | High |
| ACC-022 | Push-to-talk (keyboard) | 1. Hold spacebar to speak | Voice captured while held | Medium |
| ACC-023 | Navigate transcript | 1. Arrow keys through transcript | Navigate conversation history | Medium |
| ACC-024 | Access tools (keyboard) | 1. Keyboard shortcut for text input | Can type commands as fallback | High |
| ACC-025 | No keyboard traps | 1. Tab through entire interface | Can escape all components | High |

### 10.4 Visual Indicators

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| ACC-030 | Connection status | 1. Check connection indicator | Clear visual status (color + icon) | High |
| ACC-031 | Speaking indicator | 1. User speaks | Visual indicator of active input | High |
| ACC-032 | AI speaking indicator | 1. AI responds | Visual indicator AI is speaking | High |
| ACC-033 | Processing indicator | 1. Complex request | Visual indicator of processing | High |
| ACC-034 | Error indicators | 1. Trigger error | Clear visual error state | High |
| ACC-035 | Color blind safe | 1. Check with simulator | Status conveyed without color alone | High |
| ACC-036 | High contrast mode | 1. Enable OS high contrast | Interface remains usable | Medium |

### 10.5 Additional Accessibility

| ID | Test Case | Steps | Expected Outcome | Priority |
|----|-----------|-------|------------------|----------|
| ACC-040 | Reduced motion | 1. Enable reduced motion | Animations respect preference | Medium |
| ACC-041 | Text resize | 1. Zoom to 200% | Interface remains usable | High |
| ACC-042 | Touch targets | 1. Check button sizes | Minimum 44x44px targets | Medium |
| ACC-043 | Timeout warnings | 1. Approach session timeout | Sufficient warning time (>20s) | Medium |
| ACC-044 | Alternative input | 1. Use text instead of voice | Full functionality via text | High |

---

## Test Execution Templates

### Test Run Record

```markdown
## Test Run: [Date] - [Tester]

**Environment:**
- Browser: [Chrome/Safari/Firefox] [Version]
- OS: [macOS/Windows/Linux] [Version]  
- Network: [Condition]
- Backend: [Version/Commit]
- Client: [Version/Commit]

**Test Scope:** [Category or specific IDs]

**Results Summary:**
- Passed: X
- Failed: X
- Blocked: X
- Skipped: X

**Failed Tests:**
| ID | Description | Actual Result | Notes |
|----|-------------|---------------|-------|
| XX-XXX | ... | ... | ... |

**Issues Found:**
- [Issue description, severity, ID if filed]

**Notes:**
- [Any observations or recommendations]
```

### Bug Report Template

```markdown
## Bug: [Title]

**Test Case ID:** [XX-XXX]
**Severity:** Critical/High/Medium/Low
**Environment:** [Browser, OS, versions]

**Steps to Reproduce:**
1. ...
2. ...
3. ...

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Evidence:**
- Screenshot/recording if applicable
- Console logs
- Network trace

**Notes:**
[Additional context]
```

---

## Automation Strategy

### Unit Test Coverage

```python
# Example test structure
class TestVoiceConnection:
    def test_webrtc_connection_success(self):
        """CON-001: Initial WebRTC connection"""
        ...
    
    def test_reconnection_after_disconnect(self):
        """CON-020: Network disconnect recovery"""
        ...

class TestAudioProcessing:
    def test_microphone_permission_grant(self):
        """AUD-001: Microphone permission grant"""
        ...
    
    def test_echo_cancellation(self):
        """AUD-010: Built-in echo cancellation"""
        ...
```

### Integration Test Coverage

```python
@pytest.mark.integration
class TestE2EFlows:
    async def test_simple_query_flow(self):
        """E2E-001: Simple query"""
        ...
    
    async def test_bug_fix_workflow(self):
        """E2E-020: Bug fix workflow"""
        ...
```

### Performance Test Coverage

```python
@pytest.mark.performance
class TestLatency:
    def test_ttfa_p50(self):
        """PERF-001: TTFA P50 < 1.5s"""
        results = run_latency_test(iterations=100)
        assert np.percentile(results, 50) < 1500
    
    def test_ttfa_p95(self):
        """PERF-002: TTFA P95 < 5.0s"""
        results = run_latency_test(iterations=100)
        assert np.percentile(results, 95) < 5000
```

---

## Continuous Integration

### CI Pipeline Stages

```yaml
stages:
  - lint_and_unit:
      - Run unit tests (fast feedback)
      - Coverage: CON-001 to CON-007, AUD-001 to AUD-007
      
  - integration:
      - Run integration tests
      - Coverage: E2E-001 to E2E-005
      - Requires: Staging environment
      
  - performance:
      - Run performance benchmarks
      - Coverage: PERF-001 to PERF-008
      - Runs: Nightly or on release branches
      
  - accessibility:
      - Run automated a11y tests
      - Coverage: ACC-001 to ACC-020 (automated subset)
      - Tools: axe-core, pa11y
```

### Pre-Release Checklist

- [ ] All Critical tests passing
- [ ] All High priority tests passing  
- [ ] P50 TTFA < 1.5s
- [ ] P95 TTFA < 5.0s
- [ ] Error rate < 1%
- [ ] Memory leak test passing (1 hour)
- [ ] Accessibility audit passing
- [ ] Manual exploratory testing complete

---

*Last Updated: January 2026*
*Version: 1.0*

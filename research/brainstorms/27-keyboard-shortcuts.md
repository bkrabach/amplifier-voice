# Keyboard Shortcuts Reference

*Reference Date: 2026-01-31*
*Focus: Complete keyboard control for voice interface accessibility and power users*

---

## Design Philosophy

### Keyboard as First-Class Input

Voice interfaces must remain fully operable without voice. Keyboard shortcuts serve:
- **Accessibility**: Users with speech impairments or temporary voice unavailability
- **Power users**: Developers who prefer keyboard efficiency
- **Quiet environments**: Libraries, shared offices, late-night sessions
- **Backup control**: When microphone fails or voice recognition struggles

### Key Principles

1. **Discoverability** - Common patterns, easy to learn
2. **Consistency** - Same shortcuts across platforms where possible
3. **Non-interference** - Don't override critical system/browser shortcuts
4. **Accessibility** - Single-hand operation, minimal key combinations
5. **Customizable** - Allow users to remap shortcuts

---

## 1. Push-to-Talk Shortcuts

*Primary method for voice input control*

### 1.1 Primary Push-to-Talk

| Platform | Shortcut | Behavior |
|----------|----------|----------|
| All | `Space` | Hold to talk, release to send (when focused on voice area) |
| macOS | `Cmd + Space` | Global push-to-talk (hold) |
| Windows/Linux | `Ctrl + Space` | Global push-to-talk (hold) |
| All | `Ctrl + M` | Toggle microphone on/off |

**Behavior Details:**

```
Push-to-Talk Flow:
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Key Down          Speaking           Key Up                │
│  ─────────────────────────────────────────────────          │
│                                                             │
│  ┌─────┐     ┌──────────────────┐     ┌──────────┐         │
│  │PRESS│ ──▶ │  LISTENING...    │ ──▶ │ PROCESS  │         │
│  │Space│     │  (recording)     │     │ & SEND   │         │
│  └─────┘     └──────────────────┘     └──────────┘         │
│                                                             │
│  Visual:  ○ Gray  →  ● Green pulse  →  ◐ Blue spin         │
│  Audio:   (beep)     (ambient hum)     (send chime)        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Alternative Push-to-Talk Options

| Shortcut | Description | Use Case |
|----------|-------------|----------|
| `F4` | Function key push-to-talk | Gaming keyboard friendly |
| `Caps Lock` (hold) | Caps-lock as modifier | Single-hand operation |
| `Right Ctrl` (hold) | Right-side push-to-talk | Left-hand mouse users |

### 1.3 Push-to-Talk Settings

```typescript
interface PushToTalkConfig {
  // Primary key binding
  primaryKey: 'Space' | 'F4' | 'CapsLock' | 'Custom';
  
  // Modifier requirement (prevents accidental activation)
  requireModifier: boolean;
  modifier: 'Cmd' | 'Ctrl' | 'Alt' | 'Shift' | 'None';
  
  // Timing settings
  minHoldDuration: number;    // ms, prevent accidental taps (default: 200)
  maxHoldDuration: number;    // ms, auto-release timeout (default: 60000)
  
  // Audio feedback
  playStartSound: boolean;
  playEndSound: boolean;
  
  // Visual feedback
  showRecordingIndicator: boolean;
}
```

### 1.4 Continuous Listening Toggle

| Platform | Shortcut | Behavior |
|----------|----------|----------|
| macOS | `Cmd + Shift + S` | Toggle always-listening mode |
| Windows/Linux | `Ctrl + Shift + S` | Toggle always-listening mode |
| All | `V` | Quick toggle (when interface focused) |

**Mode Comparison:**

| Mode | Activation | Best For |
|------|------------|----------|
| Push-to-Talk | Hold key while speaking | Privacy, noisy environments |
| Continuous | Toggle on, speak freely | Hands-free, long sessions |
| Voice-Activated | "Hey Assistant" wake word | Ambient assistant mode |

---

## 2. Mute/Unmute Controls

*Audio input and output management*

### 2.1 Microphone Controls

| Platform | Shortcut | Action |
|----------|----------|--------|
| All | `Ctrl + M` | Toggle microphone mute |
| macOS | `Cmd + Shift + M` | Force mute (unmute requires double-tap) |
| Windows | `Win + Alt + K` | System-wide mute (Windows 11+) |
| All | `M` | Quick mute (when interface focused) |

**Mute State Indicators:**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Microphone States:                                         │
│                                                             │
│  🎤 Active       Mic on, ready to record                    │
│  🔇 Muted        Mic off, no audio capture                  │
│  ⚠️ Unavailable  No mic access or hardware issue            │
│  🔒 Blocked      Permission denied                          │
│                                                             │
│  Visual Indicator:                                          │
│  ┌─────┐                                                    │
│  │ 🎤  │  Green border = active                             │
│  │     │  Red border = muted                                │
│  │     │  Gray border = unavailable                         │
│  └─────┘                                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Speaker/Output Controls

| Platform | Shortcut | Action |
|----------|----------|--------|
| All | `Ctrl + Shift + M` | Toggle speaker output |
| macOS | `Cmd + Down` | Decrease volume |
| macOS | `Cmd + Up` | Increase volume |
| All | `0` | Mute AI voice output only |

### 2.3 Privacy Quick-Mute

| Shortcut | Action | Use Case |
|----------|--------|----------|
| `Escape` (double-tap) | Emergency mute all | Doorbell, phone call |
| `Ctrl + Shift + P` | Privacy mode | Pause all audio I/O |

**Privacy Mode Behavior:**

```typescript
interface PrivacyMode {
  // What gets disabled
  disableMicrophone: true;
  disableSpeaker: true;
  pauseTranscription: true;
  
  // Visual indication
  showPrivacyOverlay: boolean;
  
  // Session handling
  preserveSession: true;        // Keep WebSocket alive
  bufferCommands: boolean;      // Queue typed commands
  
  // Exit behavior
  resumeOnUnmute: boolean;
  requireExplicitExit: boolean;
}
```

---

## 3. Cancel & Interrupt Commands

*Stopping, canceling, and controlling AI responses*

### 3.1 Cancel Actions

| Shortcut | Action | Scope |
|----------|--------|-------|
| `Escape` | Cancel current action | Context-dependent |
| `Escape` (hold 1s) | Force stop all | Emergency stop |
| `Ctrl + .` | Interrupt AI mid-response | Stop AI speaking |
| `Ctrl + Z` | Undo last voice command | If reversible |

**Escape Key Behavior (Context-Sensitive):**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Current State          │  Escape Action                    │
│  ──────────────────────────────────────────────────────     │
│  Recording voice        │  Cancel recording, discard audio  │
│  AI speaking            │  Interrupt, stop response         │
│  Processing request     │  Cancel if possible               │
│  Modal/popup open       │  Close modal                      │
│  Text input focused     │  Clear input / blur               │
│  Background task        │  No action (use Ctrl+Shift+.)     │
│  Nothing active         │  No action                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Interrupt Controls

| Shortcut | Action | Feedback |
|----------|--------|----------|
| `Ctrl + .` (period) | Interrupt AI response | "Okay, I'll stop there" |
| `Space` (tap during AI speech) | Soft interrupt, start speaking | AI pauses, listens |
| `Ctrl + Shift + .` | Cancel background task | Confirmation required |

**Interrupt Behavior:**

```typescript
interface InterruptConfig {
  // Soft interrupt (tap space)
  softInterrupt: {
    behavior: 'pause' | 'stop';
    resumable: boolean;           // Can say "continue" to resume
    transitionPhrase: string;     // "Go ahead..."
  };
  
  // Hard interrupt (Ctrl + .)
  hardInterrupt: {
    behavior: 'stop';
    acknowledgment: string;       // "Stopping."
    clearQueue: boolean;          // Cancel pending responses
  };
  
  // Emergency stop (hold Escape)
  emergencyStop: {
    holdDuration: 1000;           // ms
    stopsEverything: true;
    requiresConfirmation: false;
  };
}
```

### 3.3 Undo & Redo

| Platform | Shortcut | Action |
|----------|----------|--------|
| macOS | `Cmd + Z` | Undo last action |
| Windows/Linux | `Ctrl + Z` | Undo last action |
| macOS | `Cmd + Shift + Z` | Redo |
| Windows/Linux | `Ctrl + Y` | Redo |

**Undoable Voice Actions:**

- File edits made by voice command
- Settings changes
- Message deletion
- Task cancellation

**Non-Undoable Actions:**

- External API calls already executed
- Sent messages to third parties
- Completed file deletions (unless backed up)

---

## 4. Navigation Shortcuts

*Moving through the interface efficiently*

### 4.1 Global Navigation

| Platform | Shortcut | Action |
|----------|----------|--------|
| All | `Tab` | Move to next focusable element |
| All | `Shift + Tab` | Move to previous element |
| macOS | `Cmd + K` | Open command palette / search |
| Windows/Linux | `Ctrl + K` | Open command palette / search |
| All | `?` | Show keyboard shortcuts help |

### 4.2 Voice Interface Navigation

| Platform | Shortcut | Action |
|----------|----------|--------|
| macOS | `Cmd + H` | Show conversation history |
| Windows/Linux | `Ctrl + H` | Show conversation history |
| macOS | `Cmd + B` | Show background tasks |
| Windows/Linux | `Ctrl + B` | Show background tasks |
| All | `Ctrl + 1-9` | Switch to conversation 1-9 |
| All | `Ctrl + Tab` | Next conversation |
| All | `Ctrl + Shift + Tab` | Previous conversation |

### 4.3 Transcript Navigation

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate between messages (when focused) |
| `Home` / `End` | Jump to first/last message |
| `Page Up` / `Page Down` | Scroll through transcript |
| `Enter` | Expand selected message details |
| `Ctrl + F` | Search in transcript |

**Focus Management:**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Tab Order (logical flow):                                  │
│                                                             │
│  1. Main status indicator                                   │
│  2. Microphone button (push-to-talk)                        │
│  3. Text input field (fallback input)                       │
│  4. Conversation transcript                                 │
│  5. Background tasks panel                                  │
│  6. Settings menu                                           │
│  7. Help button                                             │
│                                                             │
│  Focus trap: Modal dialogs trap focus until dismissed       │
│  Skip link: Hidden "Skip to main content" for screen readers│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Quick Actions

| Platform | Shortcut | Action |
|----------|----------|--------|
| macOS | `Cmd + R` | Repeat last AI response |
| Windows/Linux | `Ctrl + R` | Repeat last AI response |
| macOS | `Cmd + C` | Copy last AI response |
| Windows/Linux | `Ctrl + C` | Copy selected/last response |
| macOS | `Cmd + S` | Save transcript |
| Windows/Linux | `Ctrl + S` | Save transcript |
| All | `Ctrl + Enter` | Send typed message |

### 4.5 Panel & View Controls

| Platform | Shortcut | Action |
|----------|----------|--------|
| macOS | `Cmd + \` | Toggle sidebar |
| Windows/Linux | `Ctrl + \` | Toggle sidebar |
| macOS | `Cmd + Shift + F` | Toggle fullscreen |
| Windows/Linux | `F11` | Toggle fullscreen |
| All | `Ctrl + +` / `Ctrl + -` | Zoom in/out |
| All | `Ctrl + 0` | Reset zoom |

---

## 5. Accessibility Shortcuts

*Enhanced access for users with disabilities*

### 5.1 Screen Reader Support

| Shortcut | Action | Screen Reader Announcement |
|----------|--------|---------------------------|
| `Ctrl + Alt + S` | Announce current status | "Listening", "Processing", etc. |
| `Ctrl + Alt + T` | Read last transcript | Reads full AI response |
| `Ctrl + Alt + R` | Read recording status | "Recording active" / "Muted" |
| `Ctrl + Alt + Q` | Read queue status | "3 messages pending" |

**ARIA Live Region Announcements:**

```typescript
interface ScreenReaderAnnouncements {
  // Status changes (polite - doesn't interrupt)
  stateChanges: {
    listening: "Voice assistant is now listening";
    processing: "Processing your request";
    responding: "Assistant is responding";
    idle: "Ready for your input";
  };
  
  // Errors (assertive - interrupts)
  errors: {
    microphoneError: "Microphone error. Please check your device.";
    connectionLost: "Connection lost. Attempting to reconnect.";
    recognitionFailed: "Could not understand. Please try again.";
  };
  
  // Confirmations (polite)
  confirmations: {
    messageSent: "Message sent";
    actionComplete: "Action completed successfully";
    canceled: "Action canceled";
  };
}
```

### 5.2 Motor Accessibility

| Shortcut | Action | Benefit |
|----------|--------|---------|
| `F6` | Cycle through major regions | Reduces Tab presses |
| `Alt + 1-6` | Jump to region by number | Direct access |
| `Ctrl + Space` (toggle) | Toggle vs hold push-to-talk | Reduces sustained press |
| Sticky Keys compatible | All shortcuts work with sticky keys | One key at a time |

**Single-Hand Operation:**

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Left Hand Only:                                            │
│  ───────────────                                            │
│  Tab, Shift+Tab     Navigation                              │
│  Space              Push-to-talk (configurable)             │
│  Escape             Cancel                                  │
│  1-5                Quick actions (customizable)            │
│  F1-F6              Function shortcuts                      │
│                                                             │
│  Right Hand Only:                                           │
│  ────────────────                                           │
│  Arrow keys         Navigate transcript                     │
│  Enter              Confirm / Expand                        │
│  Backspace          Delete / Go back                        │
│  Right Ctrl         Push-to-talk (alternative)              │
│  Numpad             Numeric shortcuts                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Visual Accessibility

| Shortcut | Action |
|----------|--------|
| `Ctrl + Alt + H` | Toggle high contrast mode |
| `Ctrl + Alt + L` | Toggle large text mode |
| `Ctrl + Alt + A` | Toggle animations (reduce motion) |
| `Ctrl + Alt + C` | Toggle captions/transcription |

### 5.4 Cognitive Accessibility

| Shortcut | Action | Benefit |
|----------|--------|---------|
| `Ctrl + Alt + 1` | Simple mode | Reduces UI complexity |
| `Ctrl + Alt + 2` | Standard mode | Default interface |
| `Ctrl + Alt + 3` | Advanced mode | Full features visible |
| `Ctrl + /` | Show contextual help | Explains current state |

### 5.5 Timing Adjustments

```typescript
interface TimingAccessibility {
  // Extended timeouts for users who need more time
  extendedTimeouts: {
    enabled: boolean;
    multiplier: number;          // 1.5x, 2x, 3x default
  };
  
  // Key repeat settings
  keyRepeat: {
    delay: number;               // ms before repeat starts
    rate: number;                // repeats per second
  };
  
  // Hold duration adjustments
  holdDuration: {
    pushToTalk: number;          // Min hold time
    escapeCancel: number;        // Hold for emergency stop
  };
  
  // Auto-advance prevention
  autoAdvance: {
    pauseOnFocus: boolean;       // Stop auto-scroll when reading
    requireConfirmation: boolean; // Confirm before auto-actions
  };
}
```

---

## 6. Complete Shortcut Reference

### 6.1 Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────────┐
│  VOICE CONTROL                                                       │
│  ────────────────────────────────────────────────────────────────── │
│  Space (hold)          Push-to-talk                                 │
│  Ctrl+M                Toggle microphone mute                       │
│  Ctrl+Shift+S          Toggle continuous listening                  │
│  Ctrl+.                Interrupt AI response                        │
│  Escape                Cancel current action                        │
│                                                                      │
│  NAVIGATION                                                          │
│  ────────────────────────────────────────────────────────────────── │
│  Cmd/Ctrl+K            Command palette                              │
│  Cmd/Ctrl+H            Conversation history                         │
│  Cmd/Ctrl+B            Background tasks                             │
│  Tab / Shift+Tab       Navigate elements                            │
│  ↑↓                    Navigate messages                            │
│                                                                      │
│  QUICK ACTIONS                                                       │
│  ────────────────────────────────────────────────────────────────── │
│  Cmd/Ctrl+R            Repeat last response                         │
│  Cmd/Ctrl+C            Copy response                                │
│  Cmd/Ctrl+S            Save transcript                              │
│  ?                     Show shortcuts help                          │
│                                                                      │
│  ACCESSIBILITY                                                       │
│  ────────────────────────────────────────────────────────────────── │
│  Ctrl+Alt+S            Announce status                              │
│  Ctrl+Alt+H            High contrast mode                           │
│  Ctrl+Alt+C            Toggle captions                              │
│  F6                    Cycle regions                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Platform-Specific Mappings

| Action | macOS | Windows | Linux |
|--------|-------|---------|-------|
| Push-to-talk (global) | `Cmd + Space` | `Ctrl + Space` | `Ctrl + Space` |
| Toggle mute | `Cmd + Shift + M` | `Ctrl + Shift + M` | `Ctrl + Shift + M` |
| Command palette | `Cmd + K` | `Ctrl + K` | `Ctrl + K` |
| History | `Cmd + H` | `Ctrl + H` | `Ctrl + H` |
| Copy | `Cmd + C` | `Ctrl + C` | `Ctrl + C` |
| Undo | `Cmd + Z` | `Ctrl + Z` | `Ctrl + Z` |
| Fullscreen | `Cmd + Shift + F` | `F11` | `F11` |
| Quit | `Cmd + Q` | `Alt + F4` | `Alt + F4` |

### 6.3 Conflict Avoidance

**Reserved System Shortcuts (Do Not Override):**

| Platform | Shortcut | System Use |
|----------|----------|------------|
| macOS | `Cmd + Space` | Spotlight (requires opt-out) |
| macOS | `Cmd + Tab` | App switcher |
| macOS | `Cmd + Q` | Quit application |
| Windows | `Win + *` | System shortcuts |
| Windows | `Alt + Tab` | Window switcher |
| Linux | `Super + *` | Desktop environment |
| Browser | `Ctrl + W` | Close tab |
| Browser | `Ctrl + T` | New tab |
| Browser | `Ctrl + L` | Address bar |

**Resolution Strategy:**

```typescript
interface ShortcutConflictResolution {
  // Check for conflicts on registration
  detectConflicts: boolean;
  
  // Resolution options
  onConflict: 'warn' | 'skip' | 'override' | 'remap';
  
  // User notification
  notifyUser: boolean;
  suggestAlternative: boolean;
  
  // Platform-specific handling
  platformOverrides: {
    macos: Record<string, string>;
    windows: Record<string, string>;
    linux: Record<string, string>;
  };
}
```

---

## 7. Customization

### 7.1 Custom Shortcuts Interface

```typescript
interface ShortcutCustomization {
  // User-defined mappings
  customMappings: Map<string, KeyBinding>;
  
  // Shortcut profiles
  profiles: {
    default: ShortcutProfile;
    vim: ShortcutProfile;        // Vim-style navigation
    accessibility: ShortcutProfile;
    minimal: ShortcutProfile;
  };
  
  // Import/Export
  exportConfig(): string;
  importConfig(json: string): void;
  resetToDefaults(): void;
}

interface KeyBinding {
  key: string;                   // Primary key
  modifiers: Modifier[];         // Ctrl, Shift, Alt, Cmd
  action: string;                // Action identifier
  scope: 'global' | 'focused';   // When active
  enabled: boolean;
}
```

### 7.2 Shortcut Editor UI

```
┌─────────────────────────────────────────────────────────────────────┐
│  Customize Keyboard Shortcuts                              [Reset]  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Search: [________________]                                         │
│                                                                      │
│  Voice Control                                                      │
│  ├─ Push-to-talk          [Space        ] [Edit]                   │
│  ├─ Toggle mute           [Ctrl+M       ] [Edit]                   │
│  ├─ Interrupt             [Ctrl+.       ] [Edit]                   │
│  └─ Cancel                [Escape       ] [Edit]                   │
│                                                                      │
│  Navigation                                                         │
│  ├─ Command palette       [Cmd+K        ] [Edit]                   │
│  ├─ History               [Cmd+H        ] [Edit]                   │
│  └─ Search transcript     [Ctrl+F       ] [Edit]                   │
│                                                                      │
│  [Import] [Export] [Add Custom Shortcut]                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Implementation Notes

### 8.1 Key Event Handling

```typescript
// Recommended implementation pattern
class ShortcutManager {
  private shortcuts: Map<string, ShortcutHandler>;
  private activeModifiers: Set<Modifier>;
  
  handleKeyDown(event: KeyboardEvent): void {
    // Build key combination string
    const combo = this.buildCombo(event);
    
    // Check for registered shortcut
    const handler = this.shortcuts.get(combo);
    
    if (handler && handler.enabled) {
      // Prevent default browser behavior
      if (handler.preventDefault) {
        event.preventDefault();
      }
      
      // Execute action
      handler.action(event);
      
      // Announce to screen readers if applicable
      if (handler.announce) {
        this.announceAction(handler.announcement);
      }
    }
  }
  
  // Handle push-to-talk hold behavior
  handlePushToTalk(event: KeyboardEvent): void {
    if (event.type === 'keydown' && !event.repeat) {
      this.startRecording();
    } else if (event.type === 'keyup') {
      this.stopRecordingAndSend();
    }
  }
}
```

### 8.2 Focus Management

```typescript
interface FocusManager {
  // Track current focus
  currentFocus: HTMLElement | null;
  focusHistory: HTMLElement[];
  
  // Focus trap for modals
  trapFocus(container: HTMLElement): void;
  releaseFocus(): void;
  
  // Region navigation (F6)
  regions: HTMLElement[];
  currentRegionIndex: number;
  cycleRegions(direction: 'forward' | 'backward'): void;
  
  // Restore focus after actions
  saveFocus(): void;
  restoreFocus(): void;
}
```

### 8.3 Testing Checklist

| Test ID | Test Case | Expected Result | Priority |
|---------|-----------|-----------------|----------|
| KB-001 | Push-to-talk with Space | Recording starts on hold, sends on release | High |
| KB-002 | Escape cancels recording | Audio discarded, returns to idle | High |
| KB-003 | Ctrl+M toggles mute | Mic state toggles, visual updates | High |
| KB-004 | Tab navigation order | Logical flow through UI | High |
| KB-005 | Screen reader announcements | Status changes announced | Medium |
| KB-006 | Custom shortcut mapping | User shortcuts work | Medium |
| KB-007 | No keyboard traps | Can Tab out of all components | High |
| KB-008 | Sticky keys compatibility | Shortcuts work with accessibility features | Medium |
| KB-009 | Platform-specific shortcuts | Correct modifier keys per OS | High |
| KB-010 | Conflict detection | Warns on system shortcut conflicts | Low |

---

## Related Documentation

- [09-visual-ui-components.md](./09-visual-ui-components.md) - Visual feedback for shortcuts
- [15-accessibility-considerations.md](../findings/15-accessibility-considerations.md) - WCAG compliance
- [14-testing-checklist.md](./14-testing-checklist.md) - Keyboard navigation tests
- [01-ux-interaction-ideas.md](./01-ux-interaction-ideas.md) - Interaction patterns

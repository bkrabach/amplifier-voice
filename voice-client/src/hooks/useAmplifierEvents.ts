/**
 * useAmplifierEvents - SSE consumer for Amplifier debug events.
 *
 * Connects to the /events SSE endpoint and logs ALL Amplifier events
 * to the browser console with color-coded icons for easy debugging.
 *
 * Events include:
 * - 🔼 provider_request (amber) - Raw LLM requests with full message history
 * - 🔽 provider_response (green) - Raw LLM responses with token usage
 * - 🔧 tool_call/tool_result (blue) - Tool execution details
 * - 🔀 session_fork (purple) - Agent delegation events
 * - 💬 content_* (gray) - Content streaming events
 * - 🧠 thinking_* (cyan) - Claude thinking blocks
 */

import { useEffect, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// Event type to icon/color mapping
const EVENT_STYLES: Record<string, { icon: string; color: string; label: string }> = {
  // Provider/LLM events - the key debugging info
  provider_request: { icon: '🔼', color: '#f59e0b', label: 'LLM Request' },
  provider_response: { icon: '🔽', color: '#10b981', label: 'LLM Response' },
  llm_request: { icon: '🔼', color: '#f59e0b', label: 'LLM Request' },
  llm_response: { icon: '🔽', color: '#10b981', label: 'LLM Response' },

  // Tool events
  tool_call: { icon: '🔧', color: '#3b82f6', label: 'Tool Call' },
  tool_result: { icon: '🔧', color: '#3b82f6', label: 'Tool Result' },
  tool_error: { icon: '❌', color: '#ef4444', label: 'Tool Error' },

  // Session events
  session_fork: { icon: '🔀', color: '#8b5cf6', label: 'Agent Spawn' },
  session_start: { icon: '▶️', color: '#22c55e', label: 'Session Start' },
  session_end: { icon: '⏹️', color: '#6b7280', label: 'Session End' },

  // Content streaming
  content_start: { icon: '💬', color: '#6b7280', label: 'Content Start' },
  content_delta: { icon: '💬', color: '#9ca3af', label: 'Content Delta' },
  content_end: { icon: '💬', color: '#6b7280', label: 'Content End' },

  // Thinking events
  thinking_delta: { icon: '🧠', color: '#06b6d4', label: 'Thinking' },
  thinking_final: { icon: '🧠', color: '#06b6d4', label: 'Thinking Final' },

  // Context events
  context_compaction: { icon: '📦', color: '#f97316', label: 'Context Compaction' },

  // Notifications
  display_message: { icon: '📢', color: '#eab308', label: 'Notification' },
};

// Default style for unknown events
const DEFAULT_STYLE = { icon: '📨', color: '#6b7280', label: 'Event' };

interface UseAmplifierEventsOptions {
  /** Whether to automatically connect on mount (default: true) */
  autoConnect?: boolean;
  /** Whether to log events to console (default: true) */
  logToConsole?: boolean;
  /** Event types to filter (empty = all events) */
  filterTypes?: string[];
  /** Callback when event is received */
  onEvent?: (event: AmplifierEvent) => void;
}

export interface AmplifierEvent {
  type: string;
  event?: string; // Original event name if different from type
  timestamp: string;
  [key: string]: unknown;
}

interface AmplifierEventsState {
  connected: boolean;
  eventCount: number;
  lastEvent: AmplifierEvent | null;
  error: string | null;
}

function formatTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
}

function logEvent(event: AmplifierEvent): void {
  const eventType = event.type || 'unknown';
  const style = EVENT_STYLES[eventType] || DEFAULT_STYLE;
  const timestamp = formatTimestamp();

  // Build log message
  const prefix = `%c[${timestamp}] ${style.icon} ${style.label}`;
  const prefixStyle = `color: ${style.color}; font-weight: bold;`;

  // Log with expandable data
  console.log(prefix, prefixStyle, event);

  // For provider requests/responses, also log key details separately
  if (eventType === 'provider_request' || eventType === 'llm_request') {
    const messages = event.messages as unknown[];
    const model = event.model as string;
    if (messages?.length) {
      console.log(
        `%c    └─ Model: ${model || 'unknown'}, Messages: ${messages.length}`,
        'color: #9ca3af; font-style: italic;'
      );
    }
  }

  if (eventType === 'provider_response' || eventType === 'llm_response') {
    const usage = event.usage as { input_tokens?: number; output_tokens?: number };
    if (usage) {
      console.log(
        `%c    └─ Tokens: ${usage.input_tokens || 0} in / ${usage.output_tokens || 0} out`,
        'color: #9ca3af; font-style: italic;'
      );
    }
  }

  if (eventType === 'tool_call') {
    const toolName = event.tool_name as string;
    console.log(
      `%c    └─ Tool: ${toolName}`,
      'color: #9ca3af; font-style: italic;'
    );
  }

  if (eventType === 'session_fork') {
    const agent = event.agent as string;
    const childId = event.child_session_id as string;
    console.log(
      `%c    └─ Agent: ${agent}, Child: ${childId?.slice(0, 8)}...`,
      'color: #9ca3af; font-style: italic;'
    );
  }
}

export function useAmplifierEvents(options: UseAmplifierEventsOptions = {}) {
  const {
    autoConnect = true,
    logToConsole = true,
    filterTypes = [],
    onEvent,
  } = options;

  // Use refs to avoid dependency issues
  const eventSourceRef = useRef<EventSource | null>(null);
  const optionsRef = useRef({ logToConsole, filterTypes, onEvent });
  const mountedRef = useRef(true);

  // Keep options ref updated
  optionsRef.current = { logToConsole, filterTypes, onEvent };

  const [state, setState] = useState<AmplifierEventsState>({
    connected: false,
    eventCount: 0,
    lastEvent: null,
    error: null,
  });

  // Connect function - stable, no dependencies
  const connect = () => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    console.log('%c[AmplifierEvents] Connecting to SSE stream...', 'color: #8b5cf6;');

    const eventSource = new EventSource(`${API_BASE}/events`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      if (!mountedRef.current) return;
      console.log('%c[AmplifierEvents] Connected to event stream', 'color: #22c55e;');
      setState((prev) => ({ ...prev, connected: true, error: null }));
    };

    eventSource.onmessage = (e) => {
      if (!mountedRef.current) return;
      
      try {
        const event: AmplifierEvent = JSON.parse(e.data);
        event.timestamp = formatTimestamp();

        const { logToConsole, filterTypes, onEvent } = optionsRef.current;

        // Apply filter if specified
        if (filterTypes.length > 0 && !filterTypes.includes(event.type)) {
          return;
        }

        // Log to console
        if (logToConsole) {
          logEvent(event);
        }

        // Update state
        setState((prev) => ({
          ...prev,
          eventCount: prev.eventCount + 1,
          lastEvent: event,
        }));

        // Call custom handler
        onEvent?.(event);
      } catch (err) {
        console.error('[AmplifierEvents] Failed to parse event:', err, e.data);
      }
    };

    eventSource.onerror = () => {
      if (!mountedRef.current) return;
      console.warn('%c[AmplifierEvents] Connection error (will auto-reconnect)', 'color: #f59e0b;');
      setState((prev) => ({
        ...prev,
        connected: false,
        error: 'Connection lost - will auto-reconnect',
      }));
    };
  };

  // Disconnect function - stable, no dependencies
  const disconnect = () => {
    if (eventSourceRef.current) {
      console.log('%c[AmplifierEvents] Disconnecting...', 'color: #f59e0b;');
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, connected: false }));
      }
    }
  };

  // Auto-connect on mount - runs ONCE only
  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount only
    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - run once on mount

  return {
    ...state,
    connect,
    disconnect,
  };
}

export default useAmplifierEvents;

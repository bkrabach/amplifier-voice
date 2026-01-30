/**
 * Transcript Store - Manages session transcripts with persistence
 * 
 * Temporary PoC implementation using localStorage + server sync.
 * Can be replaced with proper Amplifier integration later.
 */

import { create } from 'zustand';

// API base URL (voice server)
const API_BASE = 'http://localhost:8080';

export interface TranscriptEntry {
  id: string;
  session_id: string;
  timestamp: string;
  entry_type: 'user' | 'assistant' | 'tool_call' | 'tool_result' | 'system';
  text?: string;
  tool_name?: string;
  tool_call_id?: string;
  tool_arguments?: Record<string, unknown>;
  tool_result?: Record<string, unknown>;
  audio_duration_ms?: number;
}

export interface VoiceSession {
  id: string;
  created_at: string;
  updated_at: string;
  title?: string;
  status: 'active' | 'completed';
  message_count: number;
  tool_call_count: number;
  first_message?: string;
  last_message?: string;
}

interface TranscriptState {
  // Current session
  sessionId: string | null;
  entries: TranscriptEntry[];
  pendingSync: TranscriptEntry[];
  
  // Session list (for picker)
  sessions: VoiceSession[];
  
  // Loading states
  isLoading: boolean;
  isSyncing: boolean;
  
  // Actions
  createSession: () => Promise<string>;
  setSession: (sessionId: string) => void;
  addEntry: (entry: Omit<TranscriptEntry, 'id' | 'session_id' | 'timestamp'>) => void;
  syncToServer: () => Promise<void>;
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  resumeSession: (sessionId: string, voice?: string) => Promise<{
    context_to_inject: Array<{type: string; role: string; content: Array<{type: string; text: string}>}>;
    transcript: Array<{entry_type: string; text?: string; tool_name?: string; timestamp?: string}>;
    realtime: { client_secret: { value: string } };
  }>;
  clearSession: () => void;
}

// LocalStorage key prefix
const STORAGE_KEY = 'voice_transcript_';

// Generate UUID
const uuid = () => crypto.randomUUID();

export const useTranscriptStore = create<TranscriptState>()((set, get) => ({
  sessionId: null,
  entries: [],
  pendingSync: [],
  sessions: [],
  isLoading: false,
  isSyncing: false,

  createSession: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_BASE}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      const sessionId = data.session_id;
      
      set({
        sessionId,
        entries: [],
        pendingSync: [],
        isLoading: false,
      });
      
      // Save to localStorage as backup
      localStorage.setItem(STORAGE_KEY + 'current', sessionId);
      
      console.log('[TranscriptStore] Created session:', sessionId);
      return sessionId;
    } catch (err) {
      console.error('[TranscriptStore] Failed to create session:', err);
      // Fallback: create local-only session
      const sessionId = uuid();
      set({
        sessionId,
        entries: [],
        pendingSync: [],
        isLoading: false,
      });
      localStorage.setItem(STORAGE_KEY + 'current', sessionId);
      return sessionId;
    }
  },

  setSession: (sessionId: string) => {
    set({ sessionId, entries: [], pendingSync: [] });
    localStorage.setItem(STORAGE_KEY + 'current', sessionId);
  },

  addEntry: (entryData) => {
    const { sessionId } = get();
    if (!sessionId) {
      console.warn('[TranscriptStore] No active session, cannot add entry');
      return;
    }

    const entry: TranscriptEntry = {
      ...entryData,
      id: uuid(),
      session_id: sessionId,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      entries: [...state.entries, entry],
      pendingSync: [...state.pendingSync, entry],
    }));

    // Persist to localStorage immediately
    const { entries } = get();
    localStorage.setItem(STORAGE_KEY + sessionId, JSON.stringify(entries));

    // Auto-sync if we have enough pending entries
    const { pendingSync } = get();
    if (pendingSync.length >= 5) {
      get().syncToServer();
    }
  },

  syncToServer: async () => {
    const { sessionId, pendingSync, isSyncing } = get();
    if (!sessionId || pendingSync.length === 0 || isSyncing) return;

    set({ isSyncing: true });
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: pendingSync }),
      });

      if (response.ok) {
        set({ pendingSync: [], isSyncing: false });
        console.log('[TranscriptStore] Synced', pendingSync.length, 'entries');
      } else {
        throw new Error(`Sync failed: ${response.status}`);
      }
    } catch (err) {
      console.error('[TranscriptStore] Sync failed, will retry:', err);
      set({ isSyncing: false });
      // Keep entries in pendingSync for retry
    }
  },

  loadSessions: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_BASE}/sessions`);
      const data = await response.json();
      set({ sessions: data.sessions || [], isLoading: false });
    } catch (err) {
      console.error('[TranscriptStore] Failed to load sessions:', err);
      set({ isLoading: false });
    }
  },

  loadSession: async (sessionId: string) => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}`);
      const data = await response.json();
      set({
        sessionId,
        entries: data.transcript || [],
        pendingSync: [],
        isLoading: false,
      });
      localStorage.setItem(STORAGE_KEY + 'current', sessionId);
    } catch (err) {
      console.error('[TranscriptStore] Failed to load session:', err);
      // Try localStorage fallback
      const stored = localStorage.getItem(STORAGE_KEY + sessionId);
      if (stored) {
        set({
          sessionId,
          entries: JSON.parse(stored),
          pendingSync: [],
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    }
  },

  resumeSession: async (sessionId: string, voice = 'ash') => {
    set({ isLoading: true });
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice }),
      });
      
      if (!response.ok) {
        throw new Error(`Resume failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Load the session's transcript
      set({
        sessionId,
        entries: [], // Will be populated from server
        pendingSync: [],
        isLoading: false,
      });
      
      // Load full transcript in background
      get().loadSession(sessionId);
      
      return {
        context_to_inject: data.context_to_inject || [],
        transcript: data.transcript || [],  // Full transcript for UI display
        realtime: data.realtime,
      };
    } catch (err) {
      console.error('[TranscriptStore] Failed to resume session:', err);
      set({ isLoading: false });
      throw err;
    }
  },

  clearSession: () => {
    const { pendingSync } = get();
    
    // Sync any pending entries before clearing
    if (pendingSync.length > 0) {
      get().syncToServer();
    }
    
    set({
      sessionId: null,
      entries: [],
      pendingSync: [],
    });
    
    localStorage.removeItem(STORAGE_KEY + 'current');
  },
}));

// Auto-sync on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const state = useTranscriptStore.getState();
    if (state.pendingSync.length > 0 && state.sessionId) {
      // Use sendBeacon for reliable sync on unload
      navigator.sendBeacon(
        `${API_BASE}/sessions/${state.sessionId}/transcript`,
        JSON.stringify({ entries: state.pendingSync })
      );
    }
  });
}

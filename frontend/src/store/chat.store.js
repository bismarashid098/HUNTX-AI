import { create } from 'zustand';
import * as chatService from '../services/chat.service.js';

const useChatStore = create((set, get) => ({
  sessions: [],
  activeSessionId: null,
  activeSession: null,
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingMessage: '',
  progressMessage: null,

  // Load all sessions
  loadSessions: async () => {
    try {
      const { data } = await chatService.getSessions();
      set({ sessions: data.sessions });
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  },

  // Create new session
  createSession: async () => {
    set({ isLoading: true });
    try {
      const { data } = await chatService.createSession();
      const newSession = data.session;
      set((state) => ({
        sessions: [newSession, ...state.sessions],
        activeSessionId: newSession.id,
        activeSession: newSession,
        messages: [],
        isLoading: false,
      }));
      return newSession;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // Load a session's messages
  loadSession: async (sessionId) => {
    set({ isLoading: true });
    try {
      const { data } = await chatService.getSession(sessionId);
      set({
        activeSessionId: sessionId,
        activeSession: data.session,
        messages: data.session.messages || [],
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  // Delete a session
  deleteSession: async (sessionId) => {
    await chatService.deleteSession(sessionId);
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId && s._id !== sessionId),
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
      messages: state.activeSessionId === sessionId ? [] : state.messages,
    }));
  },

  // Add a user message locally
  addUserMessage: (content) => {
    const message = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      _id: Date.now().toString(),
    };
    set((state) => ({ messages: [...state.messages, message] }));
    return message;
  },

  // Add an agent message locally
  addAgentMessage: (content, agentName, metadata = {}) => {
    const message = {
      role: 'assistant',
      content,
      agentName,
      timestamp: new Date().toISOString(),
      _id: Date.now().toString(),
      metadata,
    };
    set((state) => ({ messages: [...state.messages, message] }));
    return message;
  },

  // SSE event handlers
  setStreaming: (isStreaming) => set({ isStreaming }),
  setStreamingMessage: (msg) => set({ streamingMessage: msg }),
  setProgressMessage: (msg) => set({ progressMessage: msg }),

  // Update session title in list
  updateSessionTitle: (sessionId, title) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        (s.id === sessionId || s._id === sessionId) ? { ...s, title } : s
      ),
    }));
  },

  // Clear chat state
  clearActive: () => set({ activeSessionId: null, activeSession: null, messages: [] }),
}));

export default useChatStore;

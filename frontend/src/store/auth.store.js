import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as authService from '../services/auth.service.js';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await authService.login({ email, password });
          localStorage.setItem('huntx_token', data.token);
          set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
          return data;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await authService.register({ name, email, password });
          localStorage.setItem('huntx_token', data.token);
          set({ user: data.user, token: data.token, isAuthenticated: true, isLoading: false });
          return data;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authService.logout();
        } catch {}
        localStorage.removeItem('huntx_token');
        set({ user: null, token: null, isAuthenticated: false });
      },

      checkAuth: async () => {
        const token = localStorage.getItem('huntx_token');
        if (!token) {
          set({ isAuthenticated: false });
          return false;
        }
        try {
          const { data } = await authService.getMe();
          set({ user: data.user, isAuthenticated: true });
          return true;
        } catch {
          localStorage.removeItem('huntx_token');
          set({ user: null, token: null, isAuthenticated: false });
          return false;
        }
      },
    }),
    {
      name: 'huntx-auth',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export default useAuthStore;

import { create } from 'zustand';
import { api } from './api';

export type Role = 'user' | 'moderator' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: Role;
  email_verified: boolean;
  bio?: string | null;
  avatar_url?: string | null;
  submission_count?: number;
  reputation?: number;
}

interface AuthState {
  user: AuthUser | null;
  loaded: boolean;
  setUser: (u: AuthUser | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loaded: false,
  setUser: (user) => set({ user, loaded: true }),
  refresh: async () => {
    try {
      const user = await api<AuthUser | null>('/auth/me');
      set({ user, loaded: true });
    } catch {
      set({ user: null, loaded: true });
    }
  },
  logout: async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    set({ user: null });
  },
}));

"use client";

import { create } from "zustand";

type AuthState = {
  ready: boolean; authenticated: boolean; token: string; organizationId: string; error: string | null;
  login?: () => Promise<void>; signup?: () => Promise<void>; logout?: () => Promise<void>;
  setSession: (token: string, organizationId: string) => void; setReady: (ready: boolean) => void;
  setError: (error: string | null) => void;
  setActions: (login: () => Promise<void>, signup: () => Promise<void>, logout: () => Promise<void>) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  ready: false, authenticated: false, token: "", organizationId: "", error: null,
  setSession: (token, organizationId) => set({ token, organizationId, authenticated: true, error: null }),
  setReady: (ready) => set({ ready }),
  setError: (error) => set({ error }),
  setActions: (login, signup, logout) => set({ login, signup, logout }),
  clear: () => set({ token: "", organizationId: "", authenticated: false, error: null }),
}));

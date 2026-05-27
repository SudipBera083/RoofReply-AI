import { create } from 'zustand'

export interface User {
  id: string;
  email: string;
  role: string;
  business_id?: string;
  company_name?: string;
}

export interface Business {
  id: string;
  company_name: string;
  phone_number: string;
  email: string;
  website: string;
  timezone: string;
  working_hours: Record<string, any>;
  onboarding_completed: boolean;
}

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface StoreState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  business: Business | null;
  authHydrated: boolean;
  toasts: Toast[];
  setAuth: (tokens: { access: string; refresh?: string }, user: User) => void;
  setBusiness: (business: Business) => void;
  clearAuth: () => void;
  initializeAuth: () => void;
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

export const useStore = create<StoreState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  business: null,
  authHydrated: false,
  toasts: [],
  
  setAuth: (tokens, user) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', tokens.access);
      if (tokens.refresh) {
        localStorage.setItem('refresh_token', tokens.refresh);
      }
      localStorage.setItem('auth_user', JSON.stringify(user));
    }
    
    set((state) => ({
      accessToken: tokens.access,
      refreshToken: tokens.refresh || state.refreshToken,
      user,
      authHydrated: true
    }));
  },

  setBusiness: (business) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_business', JSON.stringify(business));
    }
    set({ business });
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('auth_business');
    }
    set({ accessToken: null, refreshToken: null, user: null, business: null, authHydrated: true });
  },

  initializeAuth: () => {
    if (typeof window !== 'undefined') {
      const access = localStorage.getItem('access_token');
      const refresh = localStorage.getItem('refresh_token');
      const userStr = localStorage.getItem('auth_user');
      const businessStr = localStorage.getItem('auth_business');

      try {
        set({
          accessToken: access,
          refreshToken: refresh,
          user: userStr ? JSON.parse(userStr) : null,
          business: businessStr ? JSON.parse(businessStr) : null,
          authHydrated: true
        });
      } catch (e) {
        // Clear if corrupted JSON
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_business');
        set({ accessToken: null, refreshToken: null, user: null, business: null, authHydrated: true });
      }
    } else {
      set({ authHydrated: true });
    }
  },

  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));
    // Auto-remove toast after 4 seconds
    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  }
}));

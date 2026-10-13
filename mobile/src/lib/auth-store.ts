import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

const TOKEN_KEY = 'financify.token';

interface AuthState {
  status: 'loading' | 'signedIn' | 'signedOut';
  token: string | null;
  hydrate: () => Promise<void>;
  setToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  token: null,
  hydrate: async () => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
    set({ token, status: token ? 'signedIn' : 'signedOut' });
  },
  setToken: async (token) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token, status: 'signedIn' });
  },
  signOut: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    set({ token: null, status: 'signedOut' });
  },
}));

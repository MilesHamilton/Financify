import { create } from 'zustand';

/** One transient message at a time, rendered by <Toast /> in the root layout. */
export const useToast = create<{ message: string | null; id: number; show: (m: string) => void }>((set) => ({
  message: null,
  id: 0,
  show: (message) => set((s) => ({ message, id: s.id + 1 })),
}));

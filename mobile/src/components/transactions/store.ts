import type { Txn } from '@contract';
import { router } from 'expo-router';
import { create } from 'zustand';

/**
 * Txns the user has seen, keyed by id. There is no single-txn endpoint, so the
 * detail screen reads from here and edits write back here so lists re-render.
 */
export const useTxnStore = create<{
  byId: Record<string, Txn>;
  put: (txns: Txn[]) => void;
  update: (id: string, fields: Partial<Txn>) => void;
}>((set) => ({
  byId: {},
  put: (txns) => set((s) => ({ byId: { ...s.byId, ...Object.fromEntries(txns.map((t) => [t.id, t])) } })),
  update: (id, fields) =>
    set((s) => (s.byId[id] ? { byId: { ...s.byId, [id]: { ...s.byId[id], ...fields } } } : s)),
}));

/** Caches the txn and opens its detail sheet. Use from any screen that lists Txns. */
export function openTxn(txn: Txn) {
  useTxnStore.getState().put([txn]);
  router.push({ pathname: '/transaction/[id]', params: { id: txn.id } });
}

/** Latest cached copy of each txn, so edits made in the detail sheet show in lists. */
export function useFreshTxns(txns: Txn[]): Txn[] {
  const byId = useTxnStore((s) => s.byId);
  return txns.map((t) => byId[t.id] ?? t);
}

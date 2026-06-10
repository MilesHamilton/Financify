"use client";

/**
 * SSR-safe display-mode detection without setState-in-effect.
 *
 * useSyncExternalStore renders the server snapshot during SSR/hydration and
 * re-renders with the client snapshot afterwards — exactly the "unknown until
 * hydrated" behavior these components need, with no effects involved.
 */

import { useSyncExternalStore } from "react";

const QUERY = "(display-mode: standalone)";

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

const emptySubscribe = () => () => {};

/** True when running as an installed (home-screen) PWA. Server snapshot: false. */
export function useIsStandalone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** False during SSR and hydration, true once the client has taken over. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** FR-041: minimum milliseconds between router.refresh() calls */
const THROTTLE_MS = 30_000;

/**
 * RevalidateOnFocus — renders null; side-effects only.
 *
 * Listens for visibilitychange → visible and window focus events.
 * On either event, calls router.refresh() if at least THROTTLE_MS (30 s)
 * have elapsed since the last refresh.
 *
 * Why both events: visibilitychange covers iOS standalone PWA resume from
 * background (the app is "frozen" while hidden); window "focus" covers
 * desktop tab switching where visibilitychange may not fire.
 *
 * router.refresh() re-runs server components for the current route without
 * destroying client state (scroll position, open sheets).
 * (FR-041, output-rendering.md § Streaming & Real-Time Updates)
 */
export function RevalidateOnFocus() {
  const router = useRouter();
  const lastRefresh = useRef<number>(0);

  useEffect(() => {
    function maybeRefresh() {
      const now = Date.now();
      if (now - lastRefresh.current < THROTTLE_MS) return;
      lastRefresh.current = now;
      router.refresh();
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        maybeRefresh();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", maybeRefresh);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", maybeRefresh);
    };
  }, [router]);

  return null;
}

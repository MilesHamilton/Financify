"use client";

/**
 * InstallPrompt — output-rendering.md § Template-Component System
 *
 * Shown only when the app is NOT running in standalone mode.
 * Guides the user to use Share → Add to Home Screen on iOS.
 * Dismissible for the current session (sessionStorage, not localStorage,
 * so it reappears each browser session — appropriate for install guidance).
 */

import { useState } from "react";
import { useHydrated, useIsStandalone } from "@/lib/use-standalone";

export function InstallPrompt() {
  const hydrated = useHydrated();
  const isStandalone = useIsStandalone();
  const [dismissedNow, setDismissedNow] = useState(false);

  // sessionStorage read is render-safe once hydrated (deterministic per render).
  const dismissed =
    dismissedNow ||
    (hydrated && sessionStorage.getItem("installPromptDismissed") === "1");

  if (!hydrated || isStandalone || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem("installPromptDismissed", "1");
    setDismissedNow(true);
  }

  return (
    <div
      className="rounded-2xl p-4 flex items-start gap-3"
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
      }}
    >
      <div className="flex-1">
        <p
          className="text-sm font-medium mb-0.5"
          style={{ color: "var(--color-text)" }}
        >
          Add Financify to your Home Screen
        </p>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Tap <strong style={{ color: "var(--color-text)" }}>Share</strong> then{" "}
          <strong style={{ color: "var(--color-text)" }}>
            Add to Home Screen
          </strong>{" "}
          in Safari for the best experience.
        </p>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        className="shrink-0 text-lg leading-none"
        style={{ color: "var(--color-text-muted)" }}
      >
        &times;
      </button>
    </div>
  );
}

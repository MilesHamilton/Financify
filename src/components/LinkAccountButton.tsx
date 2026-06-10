"use client";

/**
 * LinkAccountButton — FR-011
 *
 * Detects display-mode: standalone. In standalone (installed PWA), OAuth
 * redirects break because the OS intercepts the navigation out of the
 * standalone window. We show an instruction card instead of launching.
 *
 * In a regular browser tab: POST /api/plaid/link/start and redirect to
 * the hosted_link_url via window.location.assign.
 */

import { useState } from "react";
import { useHydrated, useIsStandalone } from "@/lib/use-standalone";

export function LinkAccountButton() {
  const hydrated = useHydrated();
  const isStandalone = useIsStandalone();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Show nothing until we know the display mode (avoids hydration flicker).
  if (!hydrated) return null;

  // In standalone mode show the instruction card per FR-011 / output-rendering.md § Screen 4.
  if (isStandalone) {
    return (
      <div
        className="rounded-2xl p-4 text-sm"
        style={{
          background: "var(--color-surface-2)",
          border: "1px solid var(--color-border)",
          color: "var(--color-text-muted)",
        }}
      >
        <p
          className="font-medium mb-1"
          style={{ color: "var(--color-text)" }}
        >
          Account linking opens in Safari
        </p>
        <p>Open Financify in Safari to link an account.</p>
      </div>
    );
  }

  // Browser mode: trigger link flow.
  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/link/start", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const { hosted_link_url } = (await res.json()) as {
        hosted_link_url: string;
      };
      window.location.assign(hosted_link_url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={busy}
        className="rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity"
        style={{
          background: "var(--color-accent)",
          color: "#fff",
          opacity: busy ? 0.6 : 1,
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "Opening Plaid…" : "Link an account"}
      </button>
      {error && (
        <p className="mt-2 text-sm" style={{ color: "var(--color-negative)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

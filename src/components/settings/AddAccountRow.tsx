"use client";

/**
 * AddAccountRow — restores the "Add account" entry point that was dropped
 * from the redesigned Settings ACCOUNT section (see the deleted
 * src/components/LinkAccountButton.tsx, git show 33c2045^:src/components/LinkAccountButton.tsx).
 * Restyled as a full-width tappable settings row (accent icon + accent
 * label) matching StaticRow/ExpandableEditorRow/LogoutRow conventions,
 * instead of the old component's standalone pill button.
 *
 * Browser: POST /api/plaid/link/start, then window.location.assign to the
 * returned hosted_link_url — same Plaid Link flow the deleted
 * LinkAccountButton used to add a NEW institution (distinct from
 * ReconnectLink's /api/plaid/link/update flow for existing items).
 *
 * Standalone (installed PWA): OAuth redirects break because the OS
 * intercepts navigation out of the standalone window (FR-011), so tapping
 * surfaces an inline "open in Safari" note instead of launching Link — the
 * same guidance the deleted component's instruction card gave, just inline
 * rather than a persistent card.
 */

import { useState } from "react";
import { CirclePlus } from "lucide-react";
import { useHydrated, useIsStandalone } from "@/lib/use-standalone";

export function AddAccountRow() {
  const hydrated = useHydrated();
  const isStandalone = useIsStandalone();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStandaloneNote, setShowStandaloneNote] = useState(false);

  async function handleClick() {
    // Display mode is unknown until hydrated (SSR always reports non-
    // standalone) — ignore taps until we're sure, rather than risk
    // launching Link inside an installed PWA.
    if (!hydrated) return;

    if (isStandalone) {
      setShowStandaloneNote(true);
      return;
    }

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
    <div style={{ borderBottom: "1px solid var(--color-border)" }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="flex w-full items-center gap-3 py-3.5 text-left"
        style={{
          opacity: busy ? 0.6 : 1,
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        <CirclePlus
          size={17}
          aria-hidden="true"
          style={{ color: "var(--color-accent)", flexShrink: 0 }}
        />
        <span
          className="flex-1 text-[15px] font-medium"
          style={{ color: "var(--color-accent)" }}
        >
          {busy ? "Opening Plaid…" : "Add account"}
        </span>
      </button>
      {showStandaloneNote && (
        <p className="px-1 pb-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
          Account linking opens in Safari — open Financify in Safari to link a
          new account.
        </p>
      )}
      {error && (
        <p className="px-1 pb-3 text-xs" style={{ color: "var(--color-negative)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

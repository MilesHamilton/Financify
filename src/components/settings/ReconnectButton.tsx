"use client";

/**
 * ReconnectButton — FR-010
 *
 * Posts to /api/plaid/link/update with the item's itemId to get a new
 * hosted_link_url, then opens it in a new browser tab. This keeps the
 * re-auth flow outside the standalone window (same OAuth-redirect reason
 * as LinkAccountButton), and opening _blank means the user can return to
 * the app after completing re-consent.
 */

import { useState } from "react";

interface ReconnectButtonProps {
  itemId: string;
}

export function ReconnectButton({ itemId }: ReconnectButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/link/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const { hosted_link_url } = (await res.json()) as {
        hosted_link_url: string;
      };
      window.open(hosted_link_url, "_blank");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={busy}
        className="rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity"
        style={{
          background: "var(--color-negative)",
          color: "#fff",
          opacity: busy ? 0.6 : 1,
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "Opening…" : "Reconnect"}
      </button>
      {error && (
        <p className="mt-1 text-xs" style={{ color: "var(--color-negative)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

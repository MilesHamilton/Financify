"use client";

/**
 * ReconnectLink — T-R43
 *
 * Same reconnect flow as src/components/settings/ReconnectButton.tsx and
 * src/components/accounts/ReconnectButton.tsx (POST /api/plaid/link/update
 * with itemId, then window.open the returned hosted_link_url in a new tab —
 * FR-010/FR-011: Plaid Link must run outside the standalone PWA context).
 * Restyled here as a plain accent-colored text link per the prototype's
 * institution row (no pill/button chrome), rather than reusing those
 * components' markup directly.
 */

import { useState } from "react";

interface ReconnectLinkProps {
  itemId: string;
}

export function ReconnectLink({ itemId }: ReconnectLinkProps) {
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
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-label="Reconnect account"
        className="text-sm font-semibold"
        style={{
          color: "var(--color-accent)",
          opacity: busy ? 0.6 : 1,
          cursor: busy ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "Opening…" : "Reconnect"}
      </button>
      {error && (
        <p
          className="max-w-[160px] text-right text-xs"
          style={{ color: "var(--color-negative)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

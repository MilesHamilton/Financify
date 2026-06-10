"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReconnectButtonProps {
  itemId: string;
}

/**
 * ReconnectButton — calls POST /api/plaid/link/update with the itemId,
 * then opens the returned hosted_link_url in a new tab (window.open _blank)
 * because Plaid Link must run outside the standalone PWA context (FR-010, FR-011).
 *
 * Shows a pending spinner during the fetch and surfaces errors inline.
 */
export function ReconnectButton({ itemId }: ReconnectButtonProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReconnect() {
    setPending(true);
    setError(null);

    try {
      const res = await fetch("/api/plaid/link/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
      }

      const data = (await res.json()) as { hosted_link_url: string };
      window.open(data.hosted_link_url, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleReconnect}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-opacity",
          "bg-[var(--color-negative)] text-white",
          pending && "opacity-60 cursor-not-allowed",
        )}
        aria-label="Reconnect account"
      >
        <RefreshCw
          size={12}
          className={cn(pending && "animate-spin")}
          aria-hidden="true"
        />
        {pending ? "Opening…" : "Reconnect"}
      </button>
      {error && (
        <p className="text-[10px] text-[var(--color-negative)] max-w-[140px] text-right">
          {error}
        </p>
      )}
    </div>
  );
}

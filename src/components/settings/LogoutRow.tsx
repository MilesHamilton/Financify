"use client";

/**
 * LogoutRow — T-R43
 *
 * Same sign-out flow as src/components/LogoutButton.tsx: (a) logoutAction
 * server action (Auth.js signOut), (b) clear all Cache Storage entries,
 * (c) unregister all service workers, (d) hard-navigate to /login. Shares
 * the same logoutAction import so the actual sign-out call is not
 * duplicated — only the cache/SW/redirect wiring and the presentation are
 * re-declared here, restyled as a full-width tappable settings row (red
 * icon + label) per the prototype instead of LogoutButton's standalone
 * pill button. LogoutButton itself is untouched — it belongs to another
 * task/screen and its markup can't be restyled from outside.
 */

import { useState } from "react";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/lib/logout-action";

export function LogoutRow() {
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);

    try {
      await logoutAction();
    } catch {
      // continue regardless
    }

    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      // continue regardless
    }

    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
    } catch {
      // continue regardless
    }

    window.location.href = "/login";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="flex w-full items-center gap-3 py-3.5 text-left"
      style={{ opacity: busy ? 0.6 : 1, cursor: busy ? "not-allowed" : "pointer" }}
    >
      <LogOut
        size={17}
        aria-hidden="true"
        style={{ color: "var(--color-negative)", flexShrink: 0 }}
      />
      <span
        className="flex-1 text-[15px] font-medium"
        style={{ color: "var(--color-negative)" }}
      >
        {busy ? "Signing out…" : "Log out"}
      </span>
    </button>
  );
}

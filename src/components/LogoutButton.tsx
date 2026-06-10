"use client";

import { useState } from "react";
import { logoutAction } from "@/lib/logout-action";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);

    // Step (a): server action — Auth.js signOut
    try {
      await logoutAction();
    } catch {
      // continue regardless
    }

    // Step (b): delete all Cache Storage entries
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    } catch {
      // continue regardless
    }

    // Step (c): unregister all service workers
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
    } catch {
      // continue regardless
    }

    // Step (d): hard navigate to /login
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      disabled={busy}
      style={{
        background: "var(--color-negative)",
        color: "#fff",
        opacity: busy ? 0.6 : 1,
        cursor: busy ? "not-allowed" : "pointer",
      }}
      className="rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}

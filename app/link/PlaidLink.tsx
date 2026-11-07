"use client";

import Script from "next/script";
import { useState } from "react";

interface PlaidHandler {
  open(): void;
}
declare global {
  interface Window {
    Plaid?: { create(config: object): PlaidHandler };
  }
}

const BACK_TO_APP = "financify://linked";

/**
 * Runs Plaid Link on this host. With `resume`, re-opens it on the OAuth
 * redirect (receivedRedirectUri) so the session finishes in whichever browser
 * the bank returned to, then hands back to the app.
 */
export function PlaidLink({ token, resume = false }: { token: string; resume?: boolean }) {
  const [message, setMessage] = useState("Opening Plaid…");

  function open() {
    window.Plaid?.create({
      token,
      receivedRedirectUri: resume ? window.location.href : undefined,
      onSuccess: async (publicToken: string, metadata: { link_session_id?: string }) => {
        setMessage("Finishing up…");
        const res = await fetch("/api/plaid/link/complete", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ public_token: publicToken, link_session_id: metadata.link_session_id }),
        });
        if (!res.ok) {
          setMessage("Couldn’t finish linking. Return to Financify and try again.");
          return;
        }
        setMessage("Account linked. Return to the Financify app.");
        window.location.href = BACK_TO_APP;
      },
      onExit: () => {
        setMessage("You can close this window and return to Financify.");
        window.location.href = BACK_TO_APP;
      },
    }).open();
  }

  return (
    <>
      <Script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js" onReady={open} />
      <p style={{ color: "#C1C1C1" }}>{message}</p>
    </>
  );
}

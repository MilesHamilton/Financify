import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

/**
 * Hosted Link completion landing page (completion_redirect_uri).
 * The public_token arrives server-side via the SESSION_FINISHED webhook —
 * this page only confirms and points the user back to the app.
 *
 * When /api/plaid/link/start was called with { platform: "ios" }, the
 * completion_redirect_uri carries ?app=1 — redirect straight to the
 * financify:// deep link so the iOS in-app browser session closes itself.
 */
export default async function LinkedPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const { app } = await searchParams;
  if (app === "1") {
    redirect("financify://linked");
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[var(--color-canvas)] px-6 text-center">
      <CheckCircle2 size={48} className="text-[var(--color-positive)]" />
      <h1 className="text-xl font-semibold text-[var(--color-text)]">
        Account linked
      </h1>
      <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
        Your transactions are syncing in the background — the first full
        history import can take a few minutes. You can close this tab and
        open Financify from your home screen.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-[var(--color-canvas)]"
      >
        Open Financify
      </Link>
    </main>
  );
}

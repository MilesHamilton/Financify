import Link from "next/link";

/**
 * OAuth redirect URI landing page (PLAID_REDIRECT_URI, allowlisted in the
 * Plaid Dashboard). With Hosted Link, Plaid normally completes the OAuth
 * round-trip on its own hosted page — a user only lands here in edge flows,
 * so this page just routes them back gracefully instead of 404ing.
 */
export default function OAuthReturnPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-[var(--color-canvas)] px-6 text-center">
      <h1 className="text-xl font-semibold text-[var(--color-text)]">
        Finishing up…
      </h1>
      <p className="max-w-sm text-sm text-[var(--color-text-muted)]">
        If the Plaid window didn&apos;t finish on its own, return to it to
        complete linking — or head back to Financify.
      </p>
      <Link
        href="/settings"
        className="mt-2 rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-[var(--color-canvas)]"
      >
        Back to Financify
      </Link>
    </main>
  );
}

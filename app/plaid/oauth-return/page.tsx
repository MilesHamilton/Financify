/**
 * OAuth redirect URI landing page (PLAID_REDIRECT_URI, allowlisted in the
 * Plaid Dashboard). Hosted Link normally completes the OAuth round-trip on
 * its own page; users only land here in edge flows.
 */
export default function OAuthReturnPage() {
  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>Finishing up…</h1>
      <p style={{ color: "#C1C1C1" }}>
        If the Plaid window didn&apos;t finish on its own, return to it to
        complete linking, then go back to the Financify app.
      </p>
    </>
  );
}

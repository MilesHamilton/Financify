import { redirect } from "next/navigation";

/**
 * Hosted Link completion landing page (completion_redirect_uri). The
 * public_token arrives server-side via the SESSION_FINISHED webhook.
 * With ?app=1 (iOS app) it deep-links back so the in-app browser closes.
 */
export default async function LinkedPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const { app } = await searchParams;
  if (app === "1") redirect("financify://linked");

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 600 }}>Account linked</h1>
      <p style={{ color: "#C1C1C1" }}>
        Your transactions are syncing in the background. You can close this
        window and return to the Financify app.
      </p>
    </>
  );
}

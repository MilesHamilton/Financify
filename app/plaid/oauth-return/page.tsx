import { latestLinkStart } from "@/lib/link-session";
import { PlaidLink } from "../../link/PlaidLink";

export const dynamic = "force-dynamic";

/**
 * OAuth redirect URI (PLAID_REDIRECT_URI, allowlisted in the Plaid Dashboard).
 * The bank returns here, in the app's sheet or in Safari after its own app;
 * Link re-opens with this URL and finishes the session on the spot.
 */
export default async function OAuthReturnPage() {
  const start = await latestLinkStart();
  console.log({ msg: "oauth_return", has_link_start: Boolean(start), item_id: start?.item_id ?? null });
  if (!start) {
    return <p style={{ color: "#C1C1C1" }}>This link has expired. Return to Financify and try again.</p>;
  }
  return <PlaidLink token={start.link_token} resume />;
}

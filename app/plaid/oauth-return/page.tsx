import { redirect } from "next/navigation";

/**
 * OAuth redirect URI (PLAID_REDIRECT_URI, allowlisted in the Plaid Dashboard).
 * A bank's app (app-to-app OAuth) opens this in Safari when it's done. Without
 * a Universal Link (personal Apple team can't sign Associated Domains), hop
 * back into the iOS app by scheme, keeping Plaid's query (oauth_state_id);
 * the app then reopens Hosted Link, which resumes after the OAuth step.
 */
export default async function OAuthReturnPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const query = new URLSearchParams(await searchParams).toString();
  redirect(`financify://oauth-return${query ? `?${query}` : ""}`);
}

import { redirect } from "next/navigation";

/**
 * OAuth redirect URI (PLAID_REDIRECT_URI, allowlisted in the Plaid Dashboard).
 * A bank's app (app-to-app OAuth) opens this in Safari when it's done. Without
 * a Universal Link (personal Apple team can't sign Associated Domains), hop
 * back into the iOS app by scheme; Hosted Link then resumes in its open sheet.
 */
export default function OAuthReturnPage() {
  redirect("financify://oauth-return");
}

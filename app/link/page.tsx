import { PlaidLink } from "./PlaidLink";

/** The page the iOS app opens to add or fix a connection (see startAppLink). */
export default async function LinkPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  if (!token?.startsWith("link-")) {
    return <p style={{ color: "#C1C1C1" }}>This link has expired. Return to Financify and try again.</p>;
  }
  return <PlaidLink token={token} />;
}

import "server-only";
import { headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { auth } from "../../auth";

const AUDIENCE = "financify-mobile";
const TOKEN_TTL = "90d";

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

/** Issues the bearer token the iOS app sends on every API call. */
export async function issueMobileToken(username: string): Promise<string> {
  return new SignJWT({ name: username })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("1")
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey());
}

/**
 * Drop-in replacement for `auth()` in API routes: accepts a mobile bearer
 * token or falls back to the web session cookie. Returns null when neither is valid.
 */
export async function requireSession(): Promise<{ user: { name: string } } | null> {
  const header = (await headers()).get("authorization");
  if (header?.startsWith("Bearer ")) {
    try {
      const { payload } = await jwtVerify(header.slice(7), secretKey(), {
        audience: AUDIENCE,
      });
      return { user: { name: String(payload.name ?? "") } };
    } catch {
      return null;
    }
  }
  const session = await auth();
  return session?.user ? { user: { name: session.user.name ?? "" } } : null;
}

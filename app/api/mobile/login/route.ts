import { NextRequest, NextResponse } from "next/server";
import { verifyCredentials } from "@/lib/credentials";
import { issueMobileToken } from "@/lib/api-auth";
import { checkRateLimit, recordFailedAttempt } from "@/lib/auth-rate-limit";

export const runtime = "nodejs";

// POST /api/mobile/login  { username, password } → { token }
export async function POST(req: NextRequest): Promise<NextResponse> {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

  const { allowed, retryAfterSeconds } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    username?: unknown;
    password?: unknown;
  } | null;

  if (!(await verifyCredentials(body?.username, body?.password))) {
    recordFailedAttempt(ip);
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = await issueMobileToken(body!.username as string);
  return NextResponse.json({ token }, { status: 200 });
}

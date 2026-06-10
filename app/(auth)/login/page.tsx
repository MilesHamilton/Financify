import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { signIn } from "../../../auth";
import { AuthError } from "next-auth";
import {
  checkRateLimit,
  recordFailedAttempt,
} from "@/lib/auth-rate-limit";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; retryAfter?: string }>;
}) {
  return (
    <LoginForm searchParams={searchParams} />
  );
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; retryAfter?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;
  const retryAfter = params.retryAfter;

  async function login(formData: FormData) {
    "use server";

    // Derive the client IP from the forwarded header (set by Vercel/proxies)
    // or fall back to a placeholder so the limiter still functions locally.
    const headersList = await headers();
    const forwarded = headersList.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";

    const { allowed, retryAfterSeconds } = checkRateLimit(ip);
    if (!allowed) {
      const minutes = Math.ceil((retryAfterSeconds ?? 0) / 60);
      redirect(`/login?error=RateLimit&retryAfter=${minutes}`);
    }

    try {
      await signIn("credentials", {
        username: formData.get("username"),
        password: formData.get("password"),
        redirectTo: "/",
      });
    } catch (e) {
      if (e instanceof AuthError) {
        recordFailedAttempt(ip);
        redirect(`/login?error=CredentialsSignin`);
      }
      throw e;
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--color-canvas)" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h1
          className="text-xl font-semibold mb-6 text-center"
          style={{ color: "var(--color-text)" }}
        >
          Financify
        </h1>

        <form action={login} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="username"
              className="text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                // @ts-expect-error CSS custom property
                "--tw-ring-color": "var(--color-accent)",
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="rounded-lg px-3 py-2 text-sm outline-none focus:ring-2"
              style={{
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                color: "var(--color-text)",
                // @ts-expect-error CSS custom property
                "--tw-ring-color": "var(--color-accent)",
              }}
            />
          </div>

          {error === "CredentialsSignin" && (
            <p
              className="text-sm text-center"
              style={{ color: "var(--color-negative)" }}
            >
              Invalid username or password.
            </p>
          )}
          {error === "RateLimit" && (
            <p
              className="text-sm text-center"
              style={{ color: "var(--color-negative)" }}
            >
              Too many attempts — try again in{" "}
              {retryAfter && parseInt(retryAfter, 10) > 0
                ? `${retryAfter} minute${parseInt(retryAfter, 10) === 1 ? "" : "s"}`
                : "a few minutes"}
              .
            </p>
          )}

          <button
            type="submit"
            className="mt-2 rounded-lg py-2.5 text-sm font-medium transition-opacity hover:opacity-90 active:opacity-75"
            style={{
              background: "var(--color-accent)",
              color: "#fff",
            }}
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

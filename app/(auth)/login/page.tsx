import { redirect } from "next/navigation";
import { signIn } from "../../../auth";
import { AuthError } from "next-auth";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <LoginForm searchParams={searchParams} />
  );
}

async function LoginForm({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const error = params.error;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        username: formData.get("username"),
        password: formData.get("password"),
        redirectTo: "/",
      });
    } catch (e) {
      if (e instanceof AuthError) {
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

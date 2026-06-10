import { LogoutButton } from "@/components/LogoutButton";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <main
      className="min-h-screen p-6"
      style={{ background: "var(--color-canvas)" }}
    >
      <h1
        className="text-xl font-semibold mb-8"
        style={{ color: "var(--color-text)" }}
      >
        Settings
      </h1>

      <LogoutButton />
    </main>
  );
}

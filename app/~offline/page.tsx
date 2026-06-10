"use client";

export default function OfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-canvas px-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/icon-192.png"
        alt="Financify"
        width={80}
        height={80}
        className="rounded-[22px] opacity-80"
      />

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-text">
          You&rsquo;re offline
        </h1>
        <p className="max-w-xs text-sm leading-relaxed text-text-muted">
          Financify will show your latest synced data when you&rsquo;re back
          online.
        </p>
      </div>

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-canvas transition-opacity active:opacity-70"
      >
        Retry
      </button>
    </main>
  );
}

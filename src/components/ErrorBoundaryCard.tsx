"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Card } from "@/components/Card";

interface Props {
  children: ReactNode;
  /** Optional heading shown in the fallback card. Defaults to "Something went wrong". */
  title?: string;
}

interface State {
  error: Error | null;
}

/**
 * Client-side class error boundary (React class components are the only mechanism
 * for componentDidCatch / getDerivedStateFromError in React 19).
 *
 * ChunkLoadError handling (stale deploy):
 *   If the caught error looks like a webpack ChunkLoadError (chunk failed to load),
 *   the component auto-reloads the page once. A sessionStorage flag prevents a
 *   reload loop in case the chunk is genuinely missing.
 */
export class ErrorBoundaryCard extends Component<Props, State> {
  static readonly RELOAD_FLAG = "ebc_chunk_reloaded";

  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundaryCard]", error, info.componentStack);

    if (ErrorBoundaryCard.isChunkLoadError(error)) {
      const alreadyReloaded = sessionStorage.getItem(
        ErrorBoundaryCard.RELOAD_FLAG,
      );
      if (!alreadyReloaded) {
        sessionStorage.setItem(ErrorBoundaryCard.RELOAD_FLAG, "1");
        window.location.reload();
      }
    }
  }

  private static isChunkLoadError(error: Error): boolean {
    // Webpack emits errors with name "ChunkLoadError" or messages containing
    // "Loading chunk" / "Loading CSS chunk".
    return (
      error.name === "ChunkLoadError" ||
      /loading (css )?chunk/i.test(error.message)
    );
  }

  private handleReload = () => {
    sessionStorage.removeItem(ErrorBoundaryCard.RELOAD_FLAG);
    window.location.reload();
  };

  render() {
    const { error } = this.state;

    if (!error) {
      return this.props.children;
    }

    const title = this.props.title ?? "Something went wrong";

    return (
      <Card title={title}>
        <p className="mb-4 text-sm text-[var(--color-text-muted)] break-words">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white active:opacity-80"
        >
          Reload
        </button>
      </Card>
    );
  }
}

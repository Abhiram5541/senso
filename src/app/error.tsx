"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/shell/logo";
import { Button, LinkButton } from "@/components/ui/button";

/**
 * The error boundary for every route under the root layout.
 *
 * Without one, a throw in a server render had nothing to render: the App
 * Router fell through to the Pages Router's `500.html`, which an App-Router
 * project never generates, and the request died with
 * `Failed to load static file for page: /500 ENOENT`. So every server error
 * produced a broken response rather than a page — which §9 calls a bug in as
 * many words.
 *
 * `reset()` re-renders the segment. That is worth offering because a good
 * share of what reaches here is transient: a connector refusing, a query
 * timing out mid-render.
 *
 * The digest is shown deliberately. Next replaces the real message with an
 * opaque hash in production, and without it on screen a user reporting the
 * fault has nothing to quote and the matching server log cannot be found.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // `onRequestError` in instrumentation.ts reports server errors to Slack;
    // this covers the ones thrown while rendering on the client, which never
    // reach it.
    console.error(`[ui] route error${error.digest ? ` (${error.digest})` : ""}: ${error.message}`);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <Link href="/" aria-label="SENSO home">
        <Wordmark />
      </Link>
      <div className="space-y-2">
        <p className="font-num text-sm text-ink-subtle">Error</p>
        <h1 className="text-title font-semibold tracking-display text-ink">
          This page could not be loaded
        </h1>
        <p className="max-w-md text-base text-ink-muted">
          Something failed while building this view. Nothing you were looking at has been
          changed. Trying again often works — the cause is usually a data source that was
          briefly unavailable.
        </p>
        {error.digest && (
          <p className="pt-1 font-num text-2xs text-ink-subtle">Reference {error.digest}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" onClick={reset}>
          Try again
        </Button>
        <LinkButton href="/">Back to SENSO</LinkButton>
      </div>
    </main>
  );
}

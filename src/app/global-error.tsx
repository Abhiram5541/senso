"use client";

import { useEffect } from "react";

/**
 * The last boundary: a throw in the root layout itself, which `error.tsx`
 * cannot catch because it renders *inside* that layout.
 *
 * It replaces the whole document, so it supplies its own `<html>` and
 * `<body>` — and, deliberately, its own styles. The root layout is what loads
 * `globals.css` and the fonts, and the one case this file exists for is the
 * root layout having failed; a token like `--color-ink` cannot be relied on
 * here, so the few values needed are written literally with system fonts
 * behind them. That is the one place in this codebase where a raw hex is
 * correct rather than a tokens violation.
 *
 * Kept deliberately plain. Anything this file imports is another thing that
 * can throw while rendering the page that exists to handle a throw.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(`[ui] root error${error.digest ? ` (${error.digest})` : ""}: ${error.message}`);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f2f5f3",
          color: "#17181c",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: "13px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#5a6b61",
            }}
          >
            SENSO
          </p>
          <h1 style={{ margin: "0 0 12px", fontSize: "28px", fontWeight: 700 }}>
            SENSO could not start this page
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: "16px", lineHeight: 1.6, color: "#44504a" }}>
            The application failed before it could render anything. Your data has not been
            changed. If this persists, the server log holds the cause.
          </p>
          {error.digest && (
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#5a6b61" }}>
              Reference {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              appearance: "none",
              border: "none",
              borderRadius: "999px",
              padding: "10px 20px",
              fontSize: "15px",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#17804a",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}

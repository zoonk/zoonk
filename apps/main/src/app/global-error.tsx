// biome-ignore-all lint/nursery/noJsxLiterals: global-error runs without translation context
"use client";

import { reportError } from "@zoonk/error-reporter/client";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            fontFamily: "system-ui, sans-serif",
            gap: "1rem",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "1rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>
            Something went wrong
          </h1>

          <p style={{ color: "#666", maxWidth: "400px" }}>
            An unexpected error occurred. Please try again or contact support if
            the problem persists.
          </p>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={reset}
              style={{
                backgroundColor: "#000",
                border: "none",
                borderRadius: "0.375rem",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.875rem",
                padding: "0.5rem 1rem",
              }}
              type="button"
            >
              Try again
            </button>

            <a
              href="mailto:hello@zoonk.com"
              style={{
                border: "1px solid #e5e5e5",
                borderRadius: "0.375rem",
                color: "#000",
                fontSize: "0.875rem",
                padding: "0.5rem 1rem",
                textDecoration: "none",
              }}
            >
              Contact support
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

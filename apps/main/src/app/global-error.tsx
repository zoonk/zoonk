"use client";

import { captureException } from "@sentry/nextjs";
import { DEFAULT_LOCALE } from "@zoonk/utils/locale";
import { Suspense, lazy, useEffect } from "react";
import "./globals.css";

/** The brand name reads the same in every language, and it shows before the messages load. */
const PAGE_TITLE = "Zoonk";

/** Every page ships this boundary, so its content and messages load only when it's needed. */
const GlobalErrorContent = lazy(() => import("@/components/errors/global-error-content"));

/**
 * The root layout failed, so this page brings its own document and styles, and the calm "This
 * page didn't load" message in the visitor's language instead of the framework's bare screen.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <html lang={DEFAULT_LOCALE}>
      <head>
        <title>{PAGE_TITLE}</title>
      </head>
      <body className="bg-background text-foreground font-sans antialiased">
        <Suspense fallback={null}>
          <GlobalErrorContent onRetry={retry} />
        </Suspense>
      </body>
    </html>
  );
}

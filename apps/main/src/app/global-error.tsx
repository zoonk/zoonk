"use client";

import { getPageRetry } from "@/components/errors/page-retry";
import { reportError } from "@/lib/sentry/report-error";
import { DEFAULT_LOCALE } from "@zoonk/utils/locale";
import "./globals.css";
import { Suspense, lazy, useEffect } from "react";

const PAGE_TITLE = "Zoonk";

/** Every page ships this boundary, so its content and messages load only when it's needed. */
const GlobalErrorContent = lazy(() => import("@/components/errors/global-error-content"));

export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return (
    <html lang={DEFAULT_LOCALE}>
      <head>
        <title>{PAGE_TITLE}</title>
      </head>
      <body className="bg-background text-foreground font-sans antialiased">
        <Suspense fallback={null}>
          <GlobalErrorContent onRetry={getPageRetry({ error, retry })} />
        </Suspense>
      </body>
    </html>
  );
}

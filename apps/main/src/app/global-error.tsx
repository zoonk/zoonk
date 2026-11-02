"use client";

import { getPageRetry } from "@/components/errors/page-retry";
import { captureException } from "@sentry/nextjs";
import { DEFAULT_LOCALE } from "@zoonk/utils/locale";
import { Suspense, lazy, useEffect } from "react";
import "./globals.css";

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
    captureException(error);
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

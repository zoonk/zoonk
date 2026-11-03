"use client";

import { reportError } from "@/lib/sentry/report-error";
import { useEffect } from "react";
import { PageErrorMessage } from "./page-error-message";
import { getPageRetry } from "./page-retry";

export function FramePageError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    reportError(error);
  }, [error]);

  return <PageErrorMessage inFrame onRetry={getPageRetry({ error, retry })} />;
}

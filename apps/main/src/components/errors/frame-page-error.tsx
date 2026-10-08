"use client";

import { captureException } from "@sentry/nextjs";
import { useEffect } from "react";
import { PageErrorMessage } from "./page-error-message";

/**
 * A page of the app's frame (the tabs, the catalog, settings) that failed: the message takes the
 * page's place while the bar and the tab bar stay, so the learner can try again or go elsewhere.
 */
export function FramePageError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return <PageErrorMessage inFrame onRetry={retry} />;
}

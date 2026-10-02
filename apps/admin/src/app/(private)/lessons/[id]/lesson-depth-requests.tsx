import {
  DEPTH_REQUEST_PERIOD_DAYS,
  type DepthRequests,
  type DepthRequestsResult,
} from "@/data/lessons/get-depth-requests";
import { ChevronsDownIcon, ChevronsUpIcon } from "lucide-react";

/**
 * "Simpler" and "Go deeper" taps on one screen, side by side with its answers and votes. Many
 * Simpler taps mean learners found the screen hard to follow.
 */
export function DepthRequestsLabel({ requests }: { requests: DepthRequests | null }) {
  if (!requests) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs tabular-nums">
      <span
        className={
          requests.simpler > 0
            ? "inline-flex items-center gap-0.5 text-amber-700 dark:text-amber-400"
            : "text-muted-foreground inline-flex items-center gap-0.5"
        }
        title={`Simpler taps, last ${DEPTH_REQUEST_PERIOD_DAYS} days`}
      >
        <ChevronsDownIcon aria-label="Simpler taps" className="size-3" />
        {requests.simpler}
      </span>
      <span
        className="text-muted-foreground inline-flex items-center gap-0.5"
        title={`Go deeper taps, last ${DEPTH_REQUEST_PERIOD_DAYS} days`}
      >
        <ChevronsUpIcon aria-label="Go deeper taps" className="size-3" />
        {requests.deeper}
      </span>
    </span>
  );
}

/** Says where the taps come from, or why they're missing, once above the screens. */
export function DepthRequestsNote({ result }: { result: DepthRequestsResult }) {
  if (result.status === "notConfigured") {
    return (
      <p className="text-muted-foreground text-xs">
        Simpler and Go deeper taps come from PostHog. Set POSTHOG_PERSONAL_API_KEY and
        POSTHOG_PROJECT_ID to see them.
      </p>
    );
  }

  if (result.status === "error") {
    return (
      <p className="text-destructive text-xs">
        Couldn&apos;t load Simpler and Go deeper taps: {result.message}
      </p>
    );
  }

  return (
    <p className="text-muted-foreground text-xs">
      Simpler and Go deeper taps are from the last {DEPTH_REQUEST_PERIOD_DAYS} days.
    </p>
  );
}

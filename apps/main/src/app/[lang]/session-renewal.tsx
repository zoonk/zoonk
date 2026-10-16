"use client";

import { watchSessionRenewal } from "@/lib/auth/session-renewal";
import { getLearnerSummaryState, subscribeToLearnerSummary } from "@/lib/learner/learner-store";
import { useEffect } from "react";

/** When the learner's session ends, as the learner summary read it; null without a learner. */
function readSessionEnd(): number | null {
  const learner = getLearnerSummaryState();
  return learner.status === "ready" ? learner.summary.identity.expiresAt : null;
}

/**
 * Renews the browser's session once a day while it's used, on every page, the player's included
 * (`lib/auth/session-renewal.ts`). Draws nothing; mounted outside the messages provider, so it
 * uses no translations or router.
 */
export function SessionRenewal() {
  useEffect(
    () => watchSessionRenewal({ readSessionEnd, subscribe: subscribeToLearnerSummary }),
    [],
  );

  return null;
}

"use client";

import { watchSessionRefresh } from "@/lib/auth/session-refresh";
import { getLearnerSummaryState, subscribeToLearnerSummary } from "@/lib/learner/learner-store";
import { useEffect } from "react";

/** Whether the learner summary read a learner, a guest included. */
function hasSession(): boolean {
  return getLearnerSummaryState().status === "ready";
}

/**
 * Gets the browser a new copy of its session before the old one runs out while the learner uses a
 * page, on every page, the player's included (`lib/auth/session-refresh.ts`). Draws nothing;
 * mounted outside the messages provider, so it uses no translations or router.
 */
export function SessionRefresh() {
  useEffect(() => watchSessionRefresh({ hasSession, subscribe: subscribeToLearnerSummary }), []);

  return null;
}

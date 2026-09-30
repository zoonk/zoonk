"use client";

import { identifyPostHogUser, syncPostHogSessionReplay } from "@/lib/posthog";
import { useEffect } from "react";

/**
 * Identifies signed-in users with the stable app user id and profile metadata
 * PostHog reports can use for filtering and finding people.
 */
export function PostHogIdentify({
  analyticsDisabled,
  plan,
  sessionReplayAllowed,
  userId,
  username,
}: {
  analyticsDisabled: boolean;
  plan: string;
  sessionReplayAllowed: boolean;
  userId: string | null;
  username: string | null;
}) {
  useEffect(() => {
    void identifyPostHogUser({ analyticsDisabled, plan, userId, username });
  }, [analyticsDisabled, plan, userId, username]);

  useEffect(() => {
    void syncPostHogSessionReplay(sessionReplayAllowed);
  }, [sessionReplayAllowed]);

  return null;
}

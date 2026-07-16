"use client";

import { identifyPostHogUser } from "@/lib/posthog";
import { useEffect } from "react";

/**
 * Identifies signed-in users with the stable app user id and profile metadata
 * PostHog reports can use for filtering and finding people.
 */
export function PostHogIdentify({
  analyticsDisabled,
  plan,
  userId,
  username,
}: {
  analyticsDisabled: boolean;
  plan: string;
  userId: string | null;
  username: string | null;
}) {
  useEffect(() => {
    identifyPostHogUser({ analyticsDisabled, plan, userId, username });
  }, [analyticsDisabled, plan, userId, username]);

  return null;
}

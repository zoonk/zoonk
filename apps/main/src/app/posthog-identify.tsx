"use client";

import { identifyPostHogUser } from "@/lib/posthog";
import { useEffect } from "react";

/**
 * Identifies signed-in users with the stable app user id and a filterable flag
 * for excluding internal users from PostHog reports.
 */
export function PostHogIdentify({
  analyticsDisabled,
  plan,
  userId,
}: {
  analyticsDisabled: boolean;
  plan: string;
  userId: string | null;
}) {
  useEffect(() => {
    identifyPostHogUser({ analyticsDisabled, plan, userId });
  }, [analyticsDisabled, plan, userId]);

  return null;
}

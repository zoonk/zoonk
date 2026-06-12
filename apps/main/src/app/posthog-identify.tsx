"use client";

import { identifyPostHogUser } from "@/lib/posthog";
import { useEffect } from "react";

/**
 * Identifies signed-in users with the stable app user id and a filterable flag
 * for excluding internal users from PostHog reports.
 */
export function PostHogIdentify({
  analyticsDisabled,
  userId,
}: {
  analyticsDisabled: boolean;
  userId: string | null;
}) {
  useEffect(() => {
    identifyPostHogUser({ analyticsDisabled, userId });
  }, [analyticsDisabled, userId]);

  return null;
}

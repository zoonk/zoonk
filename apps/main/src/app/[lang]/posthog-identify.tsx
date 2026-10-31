"use client";

import { identifyPostHogUser } from "@/lib/posthog";
import { useEffect } from "react";

/** Only adults get a person in PostHog; a minor's events stay anonymous. */
export function PostHogIdentify({
  adult,
  analyticsDisabled,
  plan,
  userId,
  username,
}: {
  adult: boolean;
  analyticsDisabled: boolean;
  plan: string;
  userId: string | null;
  username: string | null;
}) {
  useEffect(() => {
    if (adult) {
      void identifyPostHogUser({ analyticsDisabled, plan, userId, username });
    }
  }, [adult, analyticsDisabled, plan, userId, username]);

  return null;
}

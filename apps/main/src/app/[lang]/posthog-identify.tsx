"use client";

import { identifyPostHogUser } from "@/lib/posthog";
import { useEffect } from "react";

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
    void identifyPostHogUser({ analyticsDisabled, plan, userId, username });
  }, [analyticsDisabled, plan, userId, username]);

  return null;
}

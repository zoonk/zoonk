"use client";

import { type LearnerSummaryState } from "@/lib/learner/learner-snapshot";
import { useLearnerSummary } from "@/lib/learner/use-learner-summary";
import { Analytics } from "@vercel/analytics/next";
import { RegisterSharedEventProperties } from "@zoonk/core/analytics/register-shared-properties";
import { buildSharedEventProperties } from "@zoonk/core/analytics/shared-properties";
import { useMemo } from "react";
import { PostHogIdentify } from "./posthog-identify";

/**
 * Who analytics count the events for: a visitor (no session), or the learner or guest the summary
 * read, with their plan, username and goal. Null until the summary is read, or when it can't be:
 * analytics stay off rather than count someone as somebody else.
 */
function getAnalyticsViewer({ learner, locale }: { learner: LearnerSummaryState; locale: string }) {
  if (learner.status === "visitor") {
    return {
      disabled: false,
      plan: "free",
      properties: buildSharedEventProperties({ isGuest: true, locale, platform: "web" }),
      userId: null,
      username: null,
    };
  }

  if (learner.status !== "ready") {
    return null;
  }

  const { analytics, identity } = learner.summary;

  return {
    disabled: analytics.disabled,
    plan: analytics.plan,
    properties: buildSharedEventProperties({
      goal: analytics.goal,
      isGuest: false,
      locale,
      platform: "web",
    }),
    userId: identity.userId,
    username: analytics.username,
  };
}

/**
 * Analytics for every page, from the learner summary in the browser, so no page's render reads who
 * is looking. They stay off until the summary says who it is and that they allow them.
 */
export function AppAnalytics({ locale }: { locale: string }) {
  const learner = useLearnerSummary();
  const viewer = useMemo(() => getAnalyticsViewer({ learner, locale }), [learner, locale]);

  if (!viewer) {
    return null;
  }

  return (
    <>
      <RegisterSharedEventProperties properties={viewer.properties} />
      <PostHogIdentify
        analyticsDisabled={viewer.disabled}
        plan={viewer.plan}
        userId={viewer.userId}
        username={viewer.username}
      />
      {viewer.disabled ? null : <Analytics debug={false} />}
    </>
  );
}

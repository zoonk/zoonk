import { getCurrentUserAnalyticsState } from "@/data/users/get-current-user-analytics-disabled";
import { getCurrentGoal } from "@/lib/learn/current-goal";
import { Analytics } from "@vercel/analytics/next";
import { RegisterSharedEventProperties } from "@zoonk/core/analytics/register-shared-properties";
import { buildSharedEventProperties } from "@zoonk/core/analytics/shared-properties";
import { getProtectionsForAgeGroup } from "@zoonk/core/minors/age-protections";
import { getLearningProfile } from "@zoonk/core/profile/get";
import { logError } from "@zoonk/utils/logger";
import { unstable_rethrow } from "next/navigation";
import { lang } from "next/root-params";
import { PostHogIdentify } from "./posthog-identify";

async function loadAnalyticsState() {
  try {
    return await Promise.all([
      getCurrentUserAnalyticsState(),
      lang(),
      getLearningProfile(),
      getCurrentGoal(),
    ]);
  } catch (error) {
    // Next's own signals (dynamic rendering, redirects) must keep propagating.
    unstable_rethrow(error);
    logError("Analytics state failed to load", { error });
    return null;
  }
}

/**
 * Keeps the user-specific analytics lookup inside a Suspense boundary so the
 * root layout can stream the rest of the route without waiting on this flag.
 * It sits in the root layout, above every error page, so a failed lookup
 * leaves analytics out instead of replacing the whole page with an error.
 */
export async function AppAnalytics() {
  const state = await loadAnalyticsState();

  if (!state) {
    return null;
  }

  const [{ analyticsDisabled, plan, userId, username }, locale, profile, goal] = state;

  return (
    <>
      <RegisterSharedEventProperties
        properties={buildSharedEventProperties({
          goal: goal ? { kind: goal.kind, phase: goal.plan?.currentPhase ?? null } : null,
          isGuest: !userId,
          locale,
          platform: "web",
        })}
      />
      <PostHogIdentify
        analyticsDisabled={analyticsDisabled}
        plan={plan}
        sessionReplayAllowed={
          getProtectionsForAgeGroup(profile?.ageGroup ?? "unknown").sessionReplayAllowed
        }
        userId={userId}
        username={username}
      />
      {analyticsDisabled ? null : <Analytics debug={false} />}
    </>
  );
}

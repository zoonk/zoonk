import { getCurrentUserAnalyticsState } from "@/data/users/get-current-user-analytics-disabled";
import { PostHogIdentify } from "./posthog-identify";
import { PrivateAnalytics } from "./private-analytics";

/**
 * Keeps the user-specific analytics lookup inside a Suspense boundary so the
 * root layout can stream the rest of the route without waiting on this flag.
 */
export async function AppAnalytics() {
  const { analyticsDisabled, plan, userId, username } = await getCurrentUserAnalyticsState();

  return (
    <>
      <PostHogIdentify
        analyticsDisabled={analyticsDisabled}
        plan={plan}
        userId={userId}
        username={username}
      />
      {analyticsDisabled ? null : <PrivateAnalytics />}
    </>
  );
}

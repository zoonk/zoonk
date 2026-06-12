import { getCurrentUserAnalyticsState } from "@/data/users/get-current-user-analytics-disabled";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/next";
import { PostHogIdentify } from "./posthog-identify";

const googleAdsTagId = process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID;

/**
 * Keeps the user-specific analytics lookup inside a Suspense boundary so the
 * root layout can stream the rest of the route without waiting on this flag.
 */
export async function AppAnalytics() {
  const { analyticsDisabled, userId } = await getCurrentUserAnalyticsState();

  return (
    <>
      <PostHogIdentify analyticsDisabled={analyticsDisabled} userId={userId} />
      {analyticsDisabled ? null : (
        <>
          <Analytics debug={false} />
          {googleAdsTagId ? <GoogleAnalytics gaId={googleAdsTagId} /> : null}
        </>
      )}
    </>
  );
}

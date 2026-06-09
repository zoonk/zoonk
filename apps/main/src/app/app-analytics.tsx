import { getCurrentUserAnalyticsDisabled } from "@/data/users/get-current-user-analytics-disabled";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "@vercel/analytics/next";

const googleAdsTagId = process.env.NEXT_PUBLIC_GOOGLE_ADS_TAG_ID;

/**
 * Keeps the user-specific analytics lookup inside a Suspense boundary so the
 * root layout can stream the rest of the route without waiting on this flag.
 */
export async function AppAnalytics() {
  const analyticsDisabled = await getCurrentUserAnalyticsDisabled();

  if (analyticsDisabled) {
    return null;
  }

  return (
    <>
      <Analytics debug={false} />
      {googleAdsTagId ? <GoogleAnalytics gaId={googleAdsTagId} /> : null}
    </>
  );
}

import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { loadPostHog } from "@zoonk/core/analytics/posthog-browser";
import { getSentryDataCollection } from "@zoonk/utils/sentry";
import { initBotId } from "botid/client/core";

if (process.env.NODE_ENV === "production") {
  init({
    dataCollection: getSentryDataCollection(),
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });

  // Guests, sign-in codes and social sign-in: `botCheckPlugin` checks the same requests on the server.
  initBotId({ protect: [{ method: "POST", path: "/api/auth/*" }] });
}

/**
 * PostHog loads once the page has, so its SDK never delays the first paint. Session replay starts
 * only once we know the learner is an adult (see PostHogIdentify), so nobody under 18, and nobody
 * who hasn't told us their age, is ever recorded.
 */
void loadPostHog();

export const onRouterTransitionStart = captureRouterTransitionStart;

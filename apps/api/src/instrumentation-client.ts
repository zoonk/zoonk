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

  // Sign-in and sign-up for every web app: the email form posts to its page, and the rest of
  // Better Auth's requests (codes, social, guests) run through `botCheckPlugin` on the server.
  initBotId({
    protect: [
      { method: "POST", path: "/auth/login" },
      { method: "POST", path: "/v1/auth/*" },
    ],
  });
}

/**
 * PostHog loads once the page has, so its SDK never delays the first paint. Sign-in pages don't
 * know the visitor's age, so they never record sessions.
 */
void loadPostHog();

export const onRouterTransitionStart = captureRouterTransitionStart;

import { noteAppWritesSent } from "@/lib/http/app-write-ledger";
import { noteRouterTransition } from "@/lib/http/refresh-stale-pages";
import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { loadPostHog, waitForSharedProperties } from "@zoonk/core/analytics/posthog-browser";
import { getSentryDataCollection } from "@zoonk/utils/sentry";
import { initBotId } from "botid/client/core";
import { type RouterTransitionType } from "next";

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
 * Session replay starts only once we know the learner is an adult (`PostHogIdentify`), so nobody
 * under 18, or who hasn't told us their age, is ever recorded.
 */
void loadPostHog();

waitForSharedProperties();

/** Before any page's first write. */
noteAppWritesSent();

export function onRouterTransitionStart(url: string, navigationType: RouterTransitionType) {
  noteRouterTransition(navigationType);
  captureRouterTransitionStart(url, navigationType);
}

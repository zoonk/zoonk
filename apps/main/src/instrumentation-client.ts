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
 * PostHog loads once the page has, so its SDK never delays the first paint. Session replay starts
 * only once we know the learner is an adult (see PostHogIdentify), so nobody under 18, and nobody
 * who hasn't told us their age, is ever recorded.
 */
void loadPostHog();

/** The root layout registers the properties every event carries, so events wait for them. */
waitForSharedProperties();

/** Before any page's first write, so leaving a page reads what it changed (`RefreshStalePages`). */
noteAppWritesSent();

export function onRouterTransitionStart(url: string, navigationType: RouterTransitionType) {
  noteRouterTransition(navigationType);
  captureRouterTransitionStart(url, navigationType);
}

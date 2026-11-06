import { noteAppWritesSent } from "@/lib/http/app-write-ledger";
import { noteRouterTransition } from "@/lib/http/refresh-stale-pages";
import { reportRouterTransition, startSentryAfterPageLoad } from "@/lib/sentry/report-error";
import { noteNavigationStart } from "@/lib/session/tap-answer";
import { waitForSharedProperties } from "@zoonk/core/analytics/posthog-browser";
import { initBotId } from "botid/client/core";
import { type RouterTransitionType } from "next";

if (process.env.NODE_ENV === "production") {
  startSentryAfterPageLoad();

  // Guests, sign-in codes and social sign-in: `botCheckPlugin` checks the same requests on the server.
  initBotId({ protect: [{ method: "POST", path: "/api/auth/*" }] });
}

/** PostHog starts from `AppAnalytics` once the visitor's choice and country allow it. */
waitForSharedProperties();

/** Before any page's first write. */
noteAppWritesSent();

export function onRouterTransitionStart(url: string, navigationType: RouterTransitionType) {
  noteNavigationStart();
  noteRouterTransition(navigationType);
  reportRouterTransition(url, navigationType);
}

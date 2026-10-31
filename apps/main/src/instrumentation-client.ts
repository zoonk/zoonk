import { noteAppWritesSent } from "@/lib/http/app-write-ledger";
import { noteRouterTransition } from "@/lib/http/refresh-stale-pages";
import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { waitForSharedProperties } from "@zoonk/core/analytics/posthog-browser";
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
  // The cancel page's form posts its Server Action to the page, with or without a locale prefix.
  initBotId({
    protect: [
      { method: "POST", path: "/api/auth/*" },
      { method: "POST", path: "/subscription/cancel" },
      { method: "POST", path: "/*/subscription/cancel" },
    ],
  });
}

/**
 * PostHog starts from `AppAnalytics` once the visitor's choice and country allow it, and records
 * sessions only for learners known to be adults, so minors and anyone who hasn't told us their age
 * are never recorded.
 */
waitForSharedProperties();

/** Before any page's first write. */
noteAppWritesSent();

export function onRouterTransitionStart(url: string, navigationType: RouterTransitionType) {
  noteRouterTransition(navigationType);
  captureRouterTransitionStart(url, navigationType);
}

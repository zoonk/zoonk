import { noteAppWritesSent } from "@/lib/http/app-write-ledger";
import { noteRouterTransition } from "@/lib/http/refresh-stale-pages";
import { reportRouterTransition, startSentryAfterPageLoad } from "@/lib/sentry/report-error";
import { noteNavigationStart } from "@/lib/session/tap-answer";
import { waitForSharedProperties } from "@zoonk/core/analytics/posthog-browser";
import { initBotId } from "botid/client/core";
import { type RouterTransitionType } from "next";
import { installTranslationResilience } from "translation-resilience";

// Page translators swap React's text nodes for their own, so React's next change to that text
// would throw or never show (facebook/react#11538). Eager, because Edge's translator and Google
// Translate's extension don't mark the page before they start.
installTranslationResilience({ eager: true });

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

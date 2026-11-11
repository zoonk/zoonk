import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { getSentryDataCollection } from "@zoonk/utils/sentry";
import { installTranslationResilience } from "translation-resilience";

// Page translators swap React's text nodes for their own, so React's next change to that text
// would throw or never show (facebook/react#11538). Eager, because Edge's translator and Google
// Translate's extension don't mark the page before they start.
installTranslationResilience({ eager: true });

if (process.env.NODE_ENV === "production") {
  init({
    dataCollection: getSentryDataCollection(),
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

export const onRouterTransitionStart = captureRouterTransitionStart;

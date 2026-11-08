import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { getSentryDataCollection } from "@zoonk/utils/sentry";
import { initBotId } from "botid/client/core";
import { installTranslationResilience } from "translation-resilience";
import { AUTH_BASE_PATH } from "./lib/auth-base-path";

// Page translators swap React's text nodes for their own, so React's next change to that text
// would throw or never show (facebook/react#11538).
installTranslationResilience();

if (process.env.NODE_ENV === "production") {
  init({
    dataCollection: getSentryDataCollection(),
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });

  // The rest of Better Auth's requests (codes, social, guests) run through `botCheckPlugin` on
  // the server.
  initBotId({
    protect: [
      { method: "POST", path: "/auth/login" },
      { method: "POST", path: "/auth/*/login" },
      { method: "POST", path: `${AUTH_BASE_PATH}/*` },
    ],
  });
}

export const onRouterTransitionStart = captureRouterTransitionStart;

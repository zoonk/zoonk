import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { getSentryDataCollection } from "@zoonk/utils/sentry";
import { initBotId } from "botid/client/core";
import { AUTH_BASE_PATH } from "./lib/auth-base-path";

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

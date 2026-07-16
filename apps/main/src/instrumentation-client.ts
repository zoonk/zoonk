import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { getPostHogConfig } from "@zoonk/utils/posthog";
import { getSentryDataCollection } from "@zoonk/utils/sentry";
import { initBotId } from "botid/client/core";
import posthog from "posthog-js";

const postHogConfig = getPostHogConfig();

if (process.env.NODE_ENV === "production") {
  init({
    dataCollection: getSentryDataCollection(),
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enableLogs: true,
    tracesSampleRate: 0.1,
  });
}

if (postHogConfig) {
  posthog.init(postHogConfig.projectToken, {
    api_host: postHogConfig.host,
    defaults: postHogConfig.defaults,
  });
}

export const onRouterTransitionStart = captureRouterTransitionStart;

initBotId({
  protect: [
    { method: "POST", path: "/api/auth/*" },
    { method: "GET", path: "/start/learn/*" },
    // BotID sees localized browser paths before the proxy rewrites them.
    { method: "GET", path: "/*/start/learn/*" },
    { method: "GET", path: "/generate/*" },
    { method: "GET", path: "/*/generate/*" },
  ],
});

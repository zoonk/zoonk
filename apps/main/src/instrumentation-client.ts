import { getPostHogConfig } from "@/lib/posthog";
import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { initBotId } from "botid/client/core";
import posthog from "posthog-js";

const postHogConfig = getPostHogConfig();

if (process.env.NODE_ENV === "production") {
  init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enableLogs: true,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

if (postHogConfig) {
  posthog.init(postHogConfig.projectToken, {
    api_host: postHogConfig.host,
    defaults: "2026-05-30",
  });
}

export const onRouterTransitionStart = captureRouterTransitionStart;

initBotId({
  protect: [
    { method: "POST", path: "/api/auth/*" },
    { method: "GET", path: "/learn/*" },
    { method: "GET", path: "/generate/*" },
  ],
});

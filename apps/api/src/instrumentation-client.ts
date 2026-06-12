import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import posthog from "posthog-js";

const postHogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const postHogProjectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (process.env.NODE_ENV === "production") {
  init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enableLogs: true,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

if (postHogHost && postHogProjectToken) {
  posthog.init(postHogProjectToken, { api_host: postHogHost, defaults: "2026-01-30" });
}

export const onRouterTransitionStart = captureRouterTransitionStart;

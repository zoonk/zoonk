import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { getPostHogConfig } from "@zoonk/utils/posthog";
import { getSentryDataCollection } from "@zoonk/utils/sentry";
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

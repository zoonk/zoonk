import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { getPostHogConfig } from "@zoonk/utils/posthog";
import { getSentryDataCollection } from "@zoonk/utils/sentry";
import { initBotId } from "botid/client/core";
import posthog from "posthog-js";
import {
  filterPostHogEvent,
  filterPrivateTelemetryEvent,
  hasPrivateLearningUrl,
  isPrivateLearningPage,
} from "./lib/analytics-privacy";

const postHogConfig = getPostHogConfig();

if (process.env.NODE_ENV === "production") {
  init({
    beforeBreadcrumb: filterPrivateTelemetryEvent,
    beforeSend: filterPrivateTelemetryEvent,
    beforeSendLog: filterPrivateTelemetryEvent,
    beforeSendTransaction: filterPrivateTelemetryEvent,
    dataCollection: getSentryDataCollection(),
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enableLogs: true,
    tracesSampleRate: 0.1,
  });

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
}

if (postHogConfig) {
  posthog.init(postHogConfig.projectToken, {
    /** Flag requests carry initial URLs outside before_send; this app does not use remote flags. */
    advanced_disable_flags: true,
    api_host: postHogConfig.host,
    before_send: filterPostHogEvent,
    defaults: postHogConfig.defaults,
    /** Shared pages can contain private course cards, so route filters cannot protect DOM replay. */
    disable_session_recording: true,
    mask_all_element_attributes: true,
    mask_all_text: true,
  });
}

export const onRouterTransitionStart: typeof captureRouterTransitionStart = (...args) => {
  if (!isPrivateLearningPage() && !hasPrivateLearningUrl(args[0])) {
    captureRouterTransitionStart(...args);
  }
};

import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { initBotId } from "botid/client/core";

if (process.env.NODE_ENV === "production") {
  init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enableLogs: true,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

export const onRouterTransitionStart = captureRouterTransitionStart;

initBotId({
  protect: [
    {
      method: "POST",
      path: "/v1/*",
    },
    {
      method: "GET",
      path: "/v1/*",
    },
    {
      method: "PATCH",
      path: "/v1/*",
    },
  ],
});

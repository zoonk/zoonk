import { captureRouterTransitionStart, init } from "@sentry/nextjs";
import { initBotId } from "botid/client/core";

if (process.env.NODE_ENV === "production") {
  init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enableLogs: true,
    sendDefaultPii: true,
    tracesSampleRate: 0.1,
  });
}

export const onRouterTransitionStart = captureRouterTransitionStart;

initBotId({
  protect: [
    {
      method: "POST",
      path: "/api/auth/*",
    },
    {
      method: "GET",
      path: "/learn/*",
    },
    {
      method: "GET",
      path: "/generate/*",
    },
  ],
});

import { captureRouterTransitionStart, init } from "@sentry/nextjs";

if (process.env.NODE_ENV === "production") {
  init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enableLogs: true,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
  });
}

export const onRouterTransitionStart = captureRouterTransitionStart;

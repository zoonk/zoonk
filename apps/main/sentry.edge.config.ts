// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { init } from "@sentry/nextjs";
import { getSentryDataCollection } from "@zoonk/utils/sentry";

if (process.env.NODE_ENV === "production") {
  init({
    dataCollection: getSentryDataCollection(),
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enableLogs: true,
    tracesSampleRate: 0.1,
  });
}

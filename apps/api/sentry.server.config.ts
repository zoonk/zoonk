import { init } from "@sentry/nextjs";
import { getSentryDataCollection } from "@zoonk/utils/sentry";

if (process.env.NODE_ENV === "production") {
  init({
    dataCollection: getSentryDataCollection(),
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

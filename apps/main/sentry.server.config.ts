// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import { init } from "@sentry/nextjs";
import { getSentryDataCollection } from "@zoonk/utils/sentry";
import { filterPrivateTelemetryEvent } from "./src/lib/analytics-privacy";

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
}

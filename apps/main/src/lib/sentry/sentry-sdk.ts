import { init } from "@sentry/nextjs";
import { getSentryDataCollection } from "@zoonk/utils/sentry";

export { captureException, captureRouterTransitionStart } from "@sentry/nextjs";

export function startSentry() {
  init({
    dataCollection: getSentryDataCollection(),
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

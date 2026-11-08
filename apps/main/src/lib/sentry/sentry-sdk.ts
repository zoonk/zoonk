import { type ErrorEvent, httpClientIntegration, init } from "@sentry/nextjs";
import { getSentryDataCollection } from "@zoonk/utils/sentry";

export { captureException, captureRouterTransitionStart } from "@sentry/nextjs";

const READ_METHODS = new Set(["GET", "HEAD"]);
const FIREWALL_DENY_STATUS = 403;
const FIREWALL_CHALLENGE_STATUS = 429;

function isHttpClientError(event: ErrorEvent): boolean {
  return (
    event.exception?.values?.some((value) =>
      value.mechanism?.type.startsWith("auto.http.client"),
    ) ?? false
  );
}

/**
 * Vercel's firewall can stop a learner's write before the app runs, leaving only the screen's
 * "didn't go through". A stopped read needs no report: Next then loads the whole page, where the
 * browser passes the challenge.
 */
function isFirewallStoppedWrite(event: ErrorEvent): boolean {
  const method = event.request?.method ?? "GET";
  const headers = event.contexts?.response?.headers ?? {};

  return !READ_METHODS.has(method) && "x-vercel-mitigated" in headers;
}

export function startSentry() {
  init({
    beforeSend: (event) =>
      isHttpClientError(event) && !isFirewallStoppedWrite(event) ? null : event,
    dataCollection: getSentryDataCollection(),
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    integrations: [
      httpClientIntegration({
        failedRequestStatusCodes: [FIREWALL_DENY_STATUS, FIREWALL_CHALLENGE_STATUS],
      }),
    ],
    tracesSampleRate: 0.1,
  });
}

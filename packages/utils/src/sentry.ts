const SENTRY_PII_FIELD_DENYLIST = ["forwarded", "-ip", "remote-", "via", "-user"];

/**
 * Replaces Sentry's deprecated `sendDefaultPii: false` option without changing its behavior.
 * Sentry v10 keeps cookies, headers, and query parameters after filtering fields that commonly
 * contain identifying data, while disabling user details, bodies, and generative AI content.
 */
export function getSentryDataCollection() {
  return {
    cookies: { deny: SENTRY_PII_FIELD_DENYLIST },
    frameContextLines: 7,
    genAI: { inputs: false, outputs: false },
    httpBodies: [],
    httpHeaders: {
      request: { deny: SENTRY_PII_FIELD_DENYLIST },
      response: { deny: SENTRY_PII_FIELD_DENYLIST },
    },
    queryParams: { deny: SENTRY_PII_FIELD_DENYLIST },
    stackFrameVariables: true,
    userInfo: false,
  };
}

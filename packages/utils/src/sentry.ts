const SENTRY_PII_FIELD_DENYLIST = ["forwarded", "-ip", "remote-", "via", "-user"];

/**
 * Preserves our collection policy across Sentry's expanded v11 defaults.
 * Filter identifying fields from cookies, headers, and query parameters, and keep
 * user details, request bodies, database values, and AI/GraphQL content disabled.
 */
export function getSentryDataCollection() {
  return {
    cookies: { deny: SENTRY_PII_FIELD_DENYLIST },
    databaseQueryData: false,
    frameContextLines: 7,
    genAI: { inputs: false, outputs: false },
    graphQL: { document: false, variables: false },
    httpBodies: [],
    httpHeaders: {
      request: { deny: SENTRY_PII_FIELD_DENYLIST },
      response: { deny: SENTRY_PII_FIELD_DENYLIST },
    },
    stackFrameVariables: true,
    urlQueryParams: { deny: SENTRY_PII_FIELD_DENYLIST },
    userInfo: false,
  };
}

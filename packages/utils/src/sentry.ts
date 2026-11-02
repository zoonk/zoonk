const SENTRY_PII_FIELD_DENYLIST = ["forwarded", "-ip", "remote-", "via", "-user"];

/**
 * Sentry v11 collects more by default; this keeps identifying fields filtered and user details,
 * request bodies, database values and AI/GraphQL content off.
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

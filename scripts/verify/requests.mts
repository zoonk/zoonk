/** One request a page made, as `pnpm verify:pages` records it. Header names are lowercase. */
export type RequestRecord = {
  /** The Server Action it ran, by name, when the build's manifest knows its id. */
  action?: string;
  failure?: string;
  headers: Record<string, string>;
  method: string;
  resourceType: string;
  status?: number;
  url: string;
};

/**
 * What a request was for: the page's HTML (`document`), a Next.js prefetch of a linked page or a
 * navigation's own fetch of one (`prefetch`, `navigation`), a Server Action (`action`), data the
 * client fetched itself (`data`), analytics and error reporting (`analytics`), or a file (`asset`).
 */
export type RequestKind =
  | "action"
  | "analytics"
  | "asset"
  | "data"
  | "document"
  | "navigation"
  | "prefetch";

const DATA_TYPES = new Set(["eventsource", "fetch", "websocket", "xhr"]);

/** Vercel Analytics and Speed Insights (`/_vercel/…`, and their dev scripts) and Sentry's ingest. */
function isAnalytics(url: URL): boolean {
  return (
    url.pathname.startsWith("/_vercel/") ||
    url.hostname.endsWith("vercel-scripts.com") ||
    url.hostname.endsWith("sentry.io")
  );
}

export function classifyRequest(
  request: Pick<RequestRecord, "headers" | "resourceType" | "url">,
): RequestKind {
  const url = new URL(request.url);

  if (request.resourceType === "document") {
    return "document";
  }

  if (request.headers["next-action"]) {
    return "action";
  }

  if (isAnalytics(url)) {
    return "analytics";
  }

  if (request.headers.rsc === "1") {
    return request.headers["next-router-prefetch"] ? "prefetch" : "navigation";
  }

  return DATA_TYPES.has(request.resourceType) ? "data" : "asset";
}

/** Where a request or link goes, as a page's own links write it: path and query, without Next.js's `_rsc`. */
export function pathOf(url: string | URL): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("_rsc");
  return parsed.pathname + parsed.search;
}

/**
 * A request as the saved report keeps it: no headers (cookies, tokens) and no query string (signed
 * URLs), only what the findings need.
 */
export function savedRequest(request: RequestRecord) {
  const { origin, pathname } = new URL(request.url);

  return {
    action: request.action,
    failure: request.failure,
    kind: classifyRequest(request),
    method: request.method,
    status: request.status,
    url: `${origin}${pathname}`,
  };
}

/** A request's method and URL without its query, and the Server Action it ran, as a finding names it. */
export function describeRequest({
  action,
  headers,
  method,
  url,
}: Pick<RequestRecord, "action" | "headers" | "method" | "url">): string {
  const { origin, pathname } = new URL(url);
  const id = headers["next-action"];
  const ran = action ?? (id ? `action ${id}` : null);
  return `${method} ${origin}${pathname}${ran ? ` (Server Action ${ran})` : ""}`;
}

/** One request a page made, as `pnpm verify:pages` records it. Header names are lowercase. */
export type RequestRecord = {
  /** The Server Action it ran, by name, when the build's manifest knows its id. */
  action?: string;
  /** When it was sent, in ms since the epoch. */
  at?: number;
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

/**
 * A path as reports and file names show it: query values replaced by "…", since a callback's or a
 * signed URL's query can carry a credential.
 */
export function redactQuery(path: string): string {
  const url = new URL(path, "http://redacted.invalid");
  const names = [...url.searchParams.keys()];

  return names.length === 0
    ? url.pathname
    : `${url.pathname}?${names.map((name) => `${name}=…`).join("&")}`;
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

/**
 * How many prefetches a load started, and when its links came alive (its first prefetch, in ms
 * since the navigation started at `timeOrigin`): before that, a tap reloads the whole page.
 */
export function summarizePrefetches(requests: RequestRecord[], timeOrigin: number | null) {
  const prefetches = requests.filter((request) => classifyRequest(request) === "prefetch");
  const firstAt = prefetches[0]?.at;

  return {
    linksLiveMs: firstAt === undefined || timeOrigin === null ? null : firstAt - timeOrigin,
    prefetches: prefetches.length,
  };
}

/**
 * The page's RSC data written into its HTML (Next.js's `self.__next_f` pushes), in characters:
 * what its client components receive, which a prefetch of the page carries too.
 */
export function inlineRscCharacters(html: string): number {
  return [...html.matchAll(/self\.__next_f\.push\(\[1,(?<chunk>"(?:[^"\\]|\\.)*")\]\)/gu)].reduce(
    (total, match) => {
      const chunk: unknown = JSON.parse(match.groups?.chunk ?? '""');
      return total + (typeof chunk === "string" ? chunk.length : 0);
    },
    0,
  );
}

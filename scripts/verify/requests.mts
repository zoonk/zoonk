/** Header names are lowercase. */
export type RequestRecord = {
  action?: string;
  at?: number;
  failure?: string;
  headers: Record<string, string>;
  method: string;
  resourceType: string;
  status?: number;
  url: string;
};

export type RequestKind =
  | "action"
  | "analytics"
  | "asset"
  | "data"
  | "document"
  | "navigation"
  | "prefetch";

const DATA_TYPES = new Set(["eventsource", "fetch", "websocket", "xhr"]);

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
 * Query values are replaced by "…", since a callback's or a signed URL's query can carry a
 * credential.
 */
export function redactQuery(path: string): string {
  const url = new URL(path, "http://redacted.invalid");
  const names = [...url.searchParams.keys()];

  return names.length === 0
    ? url.pathname
    : `${url.pathname}?${names.map((name) => `${name}=…`).join("&")}`;
}

export function pathOf(url: string | URL): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("_rsc");
  return parsed.pathname + parsed.search;
}

/** No headers (cookies, tokens) and no query string (signed URLs). */
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

/** Before the first prefetch, a tap reloads the whole page. */
export function summarizePrefetches(requests: RequestRecord[], timeOrigin: number | null) {
  const prefetches = requests.filter((request) => classifyRequest(request) === "prefetch");
  const firstAt = prefetches[0]?.at;

  return {
    linksLiveMs: firstAt === undefined || timeOrigin === null ? null : firstAt - timeOrigin,
    prefetches: prefetches.length,
  };
}

export function inlineRscCharacters(html: string): number {
  return [...html.matchAll(/self\.__next_f\.push\(\[1,(?<chunk>"(?:[^"\\]|\\.)*")\]\)/gu)].reduce(
    (total, match) => {
      const chunk: unknown = JSON.parse(match.groups?.chunk ?? '""');
      return total + (typeof chunk === "string" ? chunk.length : 0);
    },
    0,
  );
}

import { type Finding, type LoadMeasurement } from "./checks.mts";
import { type RequestRecord, classifyRequest, describeRequest } from "./requests.mts";

const HTTP_CLIENT_ERROR = 400;
const HTTP_SERVER_ERROR = 500;

/**
 * Chrome logs every failed response as a bare "Failed to load resource", which the failed-response
 * check names with its URL, and Vercel serves `/_vercel/` scripts only on Vercel.
 */
function isNoise(text: string): boolean {
  return text.startsWith("Failed to load resource") || text.includes("/_vercel/");
}

export function errorFindings(
  load: Pick<LoadMeasurement, "console" | "pageErrors" | "requests">,
): Finding[] {
  const own = load.requests.filter((request) => classifyRequest(request) !== "analytics");

  // Next.js cancels prefetch bodies it has read enough of, and a navigation aborts the requests
  // the page it leaves still had out.
  const broken = own.filter(
    (request) => request.failure && !request.failure.includes("ERR_ABORTED"),
  );

  return [
    ...load.pageErrors.map((text): Finding => ({
      check: "uncaught error",
      level: "fail",
      message: text,
    })),
    ...load.console
      .filter((entry) => !isNoise(entry.text))
      .map((entry): Finding => ({
        check: `console ${entry.type}`,
        level: entry.type === "error" ? "fail" : "warn",
        message: entry.text,
      })),
    ...own
      .filter((request) => (request.status ?? 0) >= HTTP_CLIENT_ERROR)
      .map((request): Finding => ({
        check: "failed response",
        level: (request.status ?? 0) >= HTTP_SERVER_ERROR ? "fail" : "warn",
        message: `${request.status} ${describeRequest(request)}`,
      })),
    ...broken.map((request): Finding => ({
      check: "failed request",
      level: "warn",
      message: `${request.failure} ${describeRequest(request)}`,
    })),
  ];
}

/**
 * A POST the page sends on its own breaks the rule when it writes or starts AI, which only a
 * learner's click may; data the client fetched itself is usually data the server should render.
 */
export function requestFindings(requests: RequestRecord[]): Finding[] {
  return requests.flatMap((request): Finding[] => {
    const kind = classifyRequest(request);

    if (kind === "analytics") {
      return [];
    }

    if (kind === "action" || (request.method !== "GET" && request.method !== "HEAD")) {
      return [
        {
          check: "POST without a click",
          level: "warn",
          message: `${describeRequest(request)}: fine if it only reads; a write or a model call before a click is a bug`,
        },
      ];
    }

    return kind === "data"
      ? [{ check: "client data fetch", level: "warn", message: describeRequest(request) }]
      : [];
  });
}

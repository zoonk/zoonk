import { BETTER_AUTH_BASE_PATH } from "./config";
import { NativeAuthResponseError } from "./errors";

function getRetryAfter(headers: Headers) {
  const value = headers.get("x-retry-after");

  if (!value) {
    return;
  }

  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds >= 0 ? seconds : undefined;
}

/**
 * Runs native product facades through Better Auth's HTTP boundary so its
 * origin hooks and atomic IP rate limiter remain authoritative. A request
 * without a body is a GET. A refused or failed answer throws, so no caller
 * mistakes an outage for a missing session; a successful one keeps its
 * headers, and the caller decides who gets its cookies.
 */
export async function sendNativeAuthRequest({
  body,
  handler,
  headers,
  path,
  query = {},
  requestURL,
}: {
  body?: unknown;
  handler: (request: Request) => Promise<Response>;
  headers: Headers;
  path: string;
  query?: Record<string, string>;
  requestURL: string;
}) {
  const url = new URL(requestURL);
  url.pathname = `${BETTER_AUTH_BASE_PATH}${path}`;
  url.search = new URLSearchParams(query).toString();

  const requestHeaders = new Headers(headers);
  requestHeaders.delete("content-length");

  if (body !== undefined) {
    requestHeaders.set("content-type", "application/json");
  }

  const response = await handler(
    new Request(url, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: requestHeaders,
      method: body === undefined ? "GET" : "POST",
    }),
  );

  const responseBody: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new NativeAuthResponseError({
      body: responseBody,
      retryAfter: getRetryAfter(response.headers),
      statusCode: response.status,
    });
  }

  return { body: responseBody, headers: response.headers };
}

/** A native product facade's POST through Better Auth's HTTP boundary; answers its body. */
export async function callNativeAuthHandler(request: {
  body: unknown;
  handler: (request: Request) => Promise<Response>;
  headers: Headers;
  path: string;
  requestURL: string;
}) {
  const { body } = await sendNativeAuthRequest(request);
  return body;
}

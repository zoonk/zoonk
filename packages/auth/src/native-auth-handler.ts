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
 * origin hooks and atomic IP rate limiter remain authoritative.
 */
export async function callNativeAuthHandler({
  body,
  handler,
  headers,
  path,
  requestURL,
}: {
  body: unknown;
  handler: (request: Request) => Promise<Response>;
  headers: Headers;
  path: string;
  requestURL: string;
}) {
  const url = new URL(requestURL);
  url.pathname = `${BETTER_AUTH_BASE_PATH}${path}`;
  url.search = "";

  const requestHeaders = new Headers(headers);
  requestHeaders.delete("content-length");
  requestHeaders.set("content-type", "application/json");

  const response = await handler(
    new Request(url, { body: JSON.stringify(body), headers: requestHeaders, method: "POST" }),
  );

  const responseBody: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new NativeAuthResponseError({
      body: responseBody,
      retryAfter: getRetryAfter(response.headers),
      statusCode: response.status,
    });
  }

  return responseBody;
}

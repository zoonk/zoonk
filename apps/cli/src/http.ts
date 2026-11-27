import { CliError } from "./errors.ts";

export const BAD_REQUEST = 400;
export const UNAUTHORIZED = 401;
export const FORBIDDEN = 403;

/** Other commands wait 30 s for the credentials lock, so a refresh and its one retry holding it end sooner. */
const OAUTH_TIMEOUT_MS = 10_000;

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/u;

/** No address, no connection, or a sandbox denied the connection: the request never left this machine. */
const UNSENT_CODES = new Set([
  "EACCES",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EPERM",
]);

export type HttpResult = { body: unknown; ok: boolean; status: number };

export function unexpectedResponse(result: HttpResult): CliError {
  return new CliError(`The server answered with an unexpected response (HTTP ${result.status}).`);
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class RequestError extends CliError {
  /** False only when the request surely never reached the server. */
  readonly maybeSent: boolean;

  constructor(message: string, maybeSent: boolean) {
    super(message);
    this.name = "RequestError";
    this.maybeSent = maybeSent;
  }
}

function errorCode(error: unknown): string | null {
  const cause = error instanceof Error ? error.cause : undefined;
  const code = cause instanceof Error && "code" in cause ? cause.code : undefined;
  return typeof code === "string" && ERROR_CODE_PATTERN.test(code) ? code : null;
}

/** Fixed names only: a request's own error messages can quote its headers, and with them a token. */
function failureReason(error: unknown, code: string | null): string {
  if (error instanceof Error && error.name === "TimeoutError") {
    return " (timed out)";
  }

  return code ? ` (${code})` : "";
}

function requestError(url: URL, error: unknown, beforeAnswer: boolean): RequestError {
  const code = errorCode(error);

  return new RequestError(
    `Couldn't complete the request to ${url.origin}${failureReason(error, code)}.`,
    !beforeAnswer || !code || !UNSENT_CODES.has(code),
  );
}

/**
 * Every request carries a credential, and following a redirect could send it somewhere unencrypted.
 * A failure while reading the answer always counts as sent, whatever its code.
 */
export async function sendRequest(url: URL, init: RequestInit): Promise<HttpResult> {
  const response = await fetch(url, { ...init, redirect: "manual" }).catch((error: unknown) => {
    throw requestError(url, error, true);
  });

  const text = await response.text().catch((error: unknown) => {
    throw requestError(url, error, false);
  });

  return { body: parseJson(text), ok: response.ok, status: response.status };
}

export function postForm(url: URL, fields: Record<string, string>): Promise<HttpResult> {
  return sendRequest(url, {
    body: new URLSearchParams(fields),
    method: "POST",
    signal: AbortSignal.timeout(OAUTH_TIMEOUT_MS),
  });
}

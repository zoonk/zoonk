import { CliError } from "./errors.ts";

export const UNAUTHORIZED = 401;

const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/u;

export type HttpResult = { body: unknown; ok: boolean; status: number };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Fixed names only: a request's own error messages can quote its headers, and with them a token. */
function failureReason(error: unknown): string {
  if (error instanceof Error && error.name === "TimeoutError") {
    return " (timed out)";
  }

  const cause = error instanceof Error ? error.cause : undefined;
  const code = cause instanceof Error && "code" in cause ? cause.code : undefined;

  return typeof code === "string" && ERROR_CODE_PATTERN.test(code) ? ` (${code})` : "";
}

/** Every request carries a credential, and a redirect could send it somewhere unencrypted. */
export async function sendRequest(url: URL, init: RequestInit): Promise<HttpResult> {
  try {
    const response = await fetch(url, { ...init, redirect: "error" });
    return { body: parseJson(await response.text()), ok: response.ok, status: response.status };
  } catch (error) {
    throw new CliError(`Couldn't complete the request to ${url.origin}${failureReason(error)}.`);
  }
}

export function postForm(url: URL, fields: Record<string, string>): Promise<HttpResult> {
  return sendRequest(url, { body: new URLSearchParams(fields), method: "POST" });
}

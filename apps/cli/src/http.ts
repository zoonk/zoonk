import { CliError } from "./errors.ts";

export const UNAUTHORIZED = 401;

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

/** Every request carries a credential, and a redirect could send it somewhere unencrypted. */
export async function sendRequest(url: URL, init: RequestInit): Promise<HttpResult> {
  try {
    const response = await fetch(url, { ...init, redirect: "error" });
    return { body: parseJson(await response.text()), ok: response.ok, status: response.status };
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? error.cause : error;
    const reason = cause instanceof Error ? cause.message : String(cause);
    throw new CliError(`Couldn't reach ${url.origin}: ${reason}`);
  }
}

export function postForm(url: URL, fields: Record<string, string>): Promise<HttpResult> {
  return sendRequest(url, { body: new URLSearchParams(fields), method: "POST" });
}

import { usageError } from "./errors.ts";

const DEFAULT_API_URL = "https://api.zoonk.com";

const LOCAL_HOST_PATTERN = /(?:^|\.)localhost$|^127\.0\.0\.1$|^\[::1\]$/u;

/** HTTPS, or plain HTTP to this machine for local development: tokens and codes travel no other way. */
export function secureUrl(value: unknown): URL | null {
  if (typeof value !== "string" || !URL.canParse(value)) {
    return null;
  }

  const url = new URL(value);
  const isLocal = url.protocol === "http:" && LOCAL_HOST_PATTERN.test(url.hostname);

  return url.protocol === "https:" || isLocal ? url : null;
}

export function resolveApiOrigin(apiUrl: string | undefined): string {
  const value = apiUrl || DEFAULT_API_URL;
  const url = secureUrl(value);

  if (!url) {
    throw usageError(`"${value}" isn't an HTTPS or local API URL.`);
  }

  return url.origin;
}

export function loginCommand(origin: string): string {
  return origin === DEFAULT_API_URL ? "pnpm zoonk login" : `pnpm zoonk login --api ${origin}`;
}

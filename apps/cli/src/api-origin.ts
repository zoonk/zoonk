import { usageError } from "./errors.ts";

const DEFAULT_API_URL = "https://api.zoonk.com";

const LOCAL_HOST_PATTERN = /(?:^|\.)localhost$|^127\.0\.0\.1$|^\[::1\]$/u;

function isAllowedOrigin(url: URL): boolean {
  return (
    url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOST_PATTERN.test(url.hostname))
  );
}

/** Tokens only travel over HTTPS, or plain HTTP to this machine for local development. */
export function resolveApiOrigin(apiUrl: string | undefined): string {
  const value = apiUrl || DEFAULT_API_URL;
  const url = URL.canParse(value) ? new URL(value) : null;

  if (!url || !isAllowedOrigin(url)) {
    throw usageError(`"${value}" isn't an HTTPS or local API URL.`);
  }

  return url.origin;
}

export function loginCommand(origin: string): string {
  return origin === DEFAULT_API_URL ? "pnpm zoonk login" : `pnpm zoonk login --api ${origin}`;
}

import { headers } from "next/headers";
import { vi } from "vitest";

/** Staff capabilities read the token from `headers()`, which Next.js answers from the request. */
export function sendStaffAuthorization(authorization?: string): Headers {
  const requestHeaders = new Headers(authorization ? { authorization } : {});
  vi.mocked(headers).mockResolvedValue(requestHeaders);

  return requestHeaders;
}

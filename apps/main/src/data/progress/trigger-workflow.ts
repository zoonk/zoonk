import "server-only";
import { logError } from "@zoonk/utils/logger";
import { API_URL } from "@zoonk/utils/url";

/**
 * Server-to-server workflow triggers all need the same POST shape and failure
 * logging. This helper keeps the endpoint-specific wrappers small while making
 * sure background preload failures stay observable instead of throwing into the
 * lesson player action.
 */
export async function triggerWorkflow(input: {
  body: unknown;
  cookieHeader: string;
  endpoint: string;
  failureContext: Record<string, string>;
  logPrefix: string;
}): Promise<void> {
  const response = await fetch(`${API_URL}${input.endpoint}`, {
    body: JSON.stringify(input.body),
    headers: { "Content-Type": "application/json", Cookie: input.cookieHeader },
    method: "POST",
  });

  if (!response.ok) {
    logError(input.logPrefix, {
      ...input.failureContext,
      status: response.status,
      statusText: response.statusText,
    });
  }
}

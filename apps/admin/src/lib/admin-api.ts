import "server-only";
import { safeAsync } from "@zoonk/utils/error";
import { API_URL } from "@zoonk/utils/url";

const API_ORIGIN = new URL(API_URL).origin;

/**
 * Admin actions that start durable work (generation, freshness checks) go
 * through the public API, which owns the workflows. The admin's own session
 * token authorizes the call, so the API applies its usual admin checks.
 */
export async function postAdminApi({
  body,
  path,
  sessionToken,
}: {
  body: unknown;
  path: `/v1/${string}`;
  sessionToken: string;
}) {
  const { data: response, error } = await safeAsync(() =>
    fetch(`${API_URL}${path}`, {
      body: JSON.stringify(body),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
        Origin: API_ORIGIN,
      },
      method: "POST",
    }),
  );

  if (error || !response?.ok) {
    return { data: null, ok: false as const };
  }

  const { data } = await safeAsync(() => response.json() as Promise<unknown>);

  return { data, ok: true as const };
}

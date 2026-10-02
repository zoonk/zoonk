import "server-only";
import { logError } from "@zoonk/utils/logger";
import { API_URL } from "@zoonk/utils/url";
import { headers } from "next/headers";

const API_ORIGIN = new URL(API_URL).origin;

/**
 * What the API answered: its JSON body when it accepted, or its status (null when it couldn't be
 * reached) with the error body, so callers can tell a learner who should slow down from a failure.
 */
export type LearnerApiResponse =
  | { json: unknown; ok: true }
  | { json: unknown; ok: false; status: number | null };

/**
 * Posts to the API as the learner of this request: their cookie, so the API acts as them, and
 * their browser, so the work counts as web. Workflows run on the API, so the app starts them this
 * way and waits for the answer, never in the background.
 */
export async function postAsLearner({
  body,
  path,
}: {
  body?: unknown;
  path: string;
}): Promise<LearnerApiResponse> {
  const requestHeaders = await headers();

  try {
    const response = await fetch(`${API_URL}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Cookie: requestHeaders.get("cookie") ?? "",
        Origin: API_ORIGIN,
        "User-Agent": requestHeaders.get("user-agent") ?? "",
      },
      method: "POST",
    });

    const json: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      logError("[postAsLearner] The API refused:", { path, status: response.status });
      return { json, ok: false, status: response.status };
    }

    return { json, ok: true };
  } catch (error) {
    logError("[postAsLearner] Failed to reach the API:", error);
    return { json: null, ok: false, status: null };
  }
}

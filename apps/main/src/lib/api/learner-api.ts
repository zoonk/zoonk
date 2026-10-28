import "server-only";
import { getApiDeploymentHeaders } from "@zoonk/core/security/api-deployment";
import { logError } from "@zoonk/utils/logger";
import { API_URL } from "@zoonk/utils/url";
import { headers } from "next/headers";

const API_ORIGIN = new URL(API_URL).origin;

export type LearnerApiResponse =
  | { json: unknown; ok: true }
  | { json: unknown; ok: false; status: number | null };

/** Forwards the learner's cookie and browser, so the API acts as them and counts the work as web. */
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
        ...(await getApiDeploymentHeaders()),
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

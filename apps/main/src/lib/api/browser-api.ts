"use client";

import { safeAsync } from "@zoonk/utils/error";
import { API_URL } from "@zoonk/utils/url";
import { getWorkflowAuthHeaders } from "../workflow/auth-headers";

/**
 * The request body: a `FormData` goes as multipart (the browser sets its boundary), anything else
 * as JSON.
 */
function toRequestBody({
  body,
  headers,
}: {
  body: unknown;
  headers: Awaited<ReturnType<typeof getWorkflowAuthHeaders>>;
}): Pick<RequestInit, "body" | "headers"> {
  if (body === undefined) {
    return { headers };
  }

  if (body instanceof FormData) {
    return { body, headers };
  }

  return {
    body: JSON.stringify(body),
    headers: { ...headers, "Content-Type": "application/json" },
  };
}

/**
 * Posts to the public API from the browser as the signed-in learner or guest (Better Auth's bearer
 * token), with `body` as JSON when there is one, or as multipart when it's `FormData` (a
 * recording). Calls that can take seconds, such as writing a version of a screen or grading a
 * spoken answer, go this way rather than through a Server Action: Next.js sends a page's Server
 * Actions one at a time, so a slow one would hold up the lesson's checks. Null when the API
 * couldn't be reached.
 */
export async function postFromBrowser({
  body,
  path,
}: {
  body?: unknown;
  path: `/v1/${string}`;
}): Promise<Response | null> {
  const { data: response } = await safeAsync(async () => {
    const headers = await getWorkflowAuthHeaders();

    return fetch(`${API_URL}${path}`, { ...toRequestBody({ body, headers }), method: "POST" });
  });

  return response;
}

/**
 * Reads from the public API in the browser as the signed-in learner or guest, for screens that
 * ask again every few seconds: a Server Action would run in a transition, which holds the screen's
 * other actions as pending while it waits. Null when the API couldn't be reached.
 */
export async function getFromBrowser(path: `/v1/${string}`): Promise<Response | null> {
  const { data: response } = await safeAsync(async () => {
    const headers = await getWorkflowAuthHeaders();
    return fetch(`${API_URL}${path}`, { headers });
  });

  return response;
}

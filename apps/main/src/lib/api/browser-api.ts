"use client";

import { getBrowserApiUrl } from "@/lib/browser-api-url";
import { safeAsync } from "@zoonk/utils/error";
import { getWorkflowAuthHeaders } from "../workflow/auth-headers";

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
 * For calls that take seconds: Next.js sends a page's Server Actions one at a time, so a slow one
 * would hold up the lesson's checks. Null when the API couldn't be reached.
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

    return fetch(`${getBrowserApiUrl()}${path}`, {
      ...toRequestBody({ body, headers }),
      method: "POST",
    });
  });

  return response;
}

/**
 * For screens that ask again every few seconds: a Server Action runs in a transition, which holds the
 * screen's other actions as pending. Null when the API couldn't be reached.
 */
export async function getFromBrowser(path: `/v1/${string}`): Promise<Response | null> {
  const { data: response } = await safeAsync(async () => {
    const headers = await getWorkflowAuthHeaders();
    return fetch(`${getBrowserApiUrl()}${path}`, { headers });
  });

  return response;
}

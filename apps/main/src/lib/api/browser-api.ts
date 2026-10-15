"use client";

import { getBrowserApiUrl } from "@/lib/browser-api-url";
import { checkIdentity } from "@/lib/learner/learner-identity";
import { safeAsync } from "@zoonk/utils/error";
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

/** The answer while the page still belongs to the learner the browser holds; else nothing. */
function forThisLearner(response: Response): Response | null {
  return checkIdentity() ? response : null;
}

/**
 * An answer's JSON body, read for the learner who asked: null when it isn't JSON, or when the page
 * stopped belonging to the learner the browser holds while it was read. Callers read bodies with
 * this, so nothing reaches a page drawn for someone else.
 */
export async function readJsonForThisLearner(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  return checkIdentity() ? body : null;
}

/**
 * Posts to the public API from the browser as the signed-in learner or guest (Better Auth's bearer
 * token), with `body` as JSON when there is one, or as multipart when it's `FormData` (a
 * recording). Calls that can take seconds, such as writing a version of a screen or grading a
 * spoken answer, go this way rather than through a Server Action: Next.js sends a page's Server
 * Actions one at a time, so a slow one would hold up the lesson's checks. Null when the API
 * couldn't be reached, or when the page no longer belongs to the learner the browser holds, before
 * it sends or once its answer arrives. Its body is read with `readJsonForThisLearner`.
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

    // The token was read for the session of now: a page drawn for someone else sends nothing.
    if (!checkIdentity()) {
      return null;
    }

    const answer = await fetch(`${getBrowserApiUrl()}${path}`, {
      ...toRequestBody({ body, headers }),
      method: "POST",
    });

    return forThisLearner(answer);
  });

  return response;
}

/**
 * Reads from the public API in the browser as the signed-in learner or guest, for screens that
 * ask again every few seconds: a Server Action would run in a transition, which holds the screen's
 * other actions as pending while it waits. Null when the API couldn't be reached, or when its
 * answer comes in after the page stopped belonging to the learner the browser holds. Its body is
 * read with `readJsonForThisLearner`.
 */
export async function getFromBrowser(path: `/v1/${string}`): Promise<Response | null> {
  const { data: response } = await safeAsync(async () => {
    const headers = await getWorkflowAuthHeaders();
    return forThisLearner(await fetch(`${getBrowserApiUrl()}${path}`, { headers }));
  });

  return response;
}

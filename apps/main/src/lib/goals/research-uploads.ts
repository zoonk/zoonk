"use client";

import { postFromBrowser } from "../api/browser-api";

/**
 * Answers the goal's upload request with what the learner just uploaded: `POST /v1/research`
 * clears the ask, starts research with these sources, and rebuilds the goal's curriculum from
 * them once research has read them. Research runs on the API, so the browser asks it directly,
 * as the learner.
 */
export async function answerUploadRequest({
  goalId,
  sourceIds,
}: {
  goalId: string;
  sourceIds: string[];
}): Promise<boolean> {
  const response = await postFromBrowser({ body: { goalId, sourceIds }, path: "/v1/research" });
  return Boolean(response?.ok);
}

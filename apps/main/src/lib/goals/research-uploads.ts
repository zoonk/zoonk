"use client";

import { postFromBrowser } from "../api/browser-api";

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

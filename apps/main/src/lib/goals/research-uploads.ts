"use client";

import { type UploadAnswer } from "@zoonk/learn/upload-request";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { postFromBrowser } from "../api/browser-api";

export async function answerUploadRequest({
  goalId,
  sourceIds,
}: {
  goalId: string;
  sourceIds: string[];
}): Promise<UploadAnswer> {
  const response = await postFromBrowser({ body: { goalId, sourceIds }, path: "/v1/research" });

  if (!response) {
    return "failed";
  }

  if (response.ok) {
    return "answered";
  }

  const body: unknown = await response.json().catch(() => null);
  const code = getString(isJsonObject(body) ? body.error : null, "code");

  return code === "UPLOAD_ALREADY_READ" ? "alreadyRead" : "failed";
}

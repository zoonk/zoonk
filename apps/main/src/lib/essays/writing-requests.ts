"use client";

import { sendFromBrowser } from "@/lib/api/browser-api";
import { writingDraftSchema, writingStartSchema } from "@zoonk/core/exams/essays/writing-contract";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/error-codes";
import { type WritingDraftAnswer, type WritingStartAnswer } from "@zoonk/learn/writing";
import { getString, isJsonObject } from "@zoonk/utils/json";

const HTTP_CONFLICT = 409;
const HTTP_NOT_FOUND = 404;

function essayPath(blockId: string, rest: string) {
  return `/v1/essays/${encodeURIComponent(blockId)}/${rest}` as const;
}

/** A start is the learner's tap: it admits the grading, or answers with the run writing the question. */
export async function startWritingFromBrowser({
  blockId,
  previousAttemptId,
}: {
  blockId: string;
  previousAttemptId?: string;
}): Promise<WritingStartAnswer | "notWriting"> {
  const response = await sendFromBrowser({
    body: previousAttemptId ? { previousAttemptId } : {},
    method: "POST",
    path: essayPath(blockId, "starts"),
  });

  if (!response) {
    return { status: "failed" };
  }

  const body: unknown = await response.json().catch(() => null);
  const code = isJsonObject(body) ? getString(body.error, "code") : null;

  if (code === LESSON_PLAYER_ERROR_CODES.signUpRequired) {
    return { status: "signUpRequired" };
  }

  const parsed = writingStartSchema.safeParse(body);

  if (!parsed.success) {
    // An essay from before written prompts has no start: its page opens as it always did.
    return response.status === HTTP_NOT_FOUND ? "notWriting" : { status: "failed" };
  }

  return parsed.data.status === "writing"
    ? { generationId: parsed.data.runId, status: "writing" }
    : parsed.data;
}

export async function saveWritingDraftFromBrowser({
  blockId,
  draft,
}: {
  blockId: string;
  draft: { admissionId: string; revision: number; text: string };
}): Promise<WritingDraftAnswer> {
  const response = await sendFromBrowser({
    body: draft,
    method: "PUT",
    path: essayPath(blockId, "draft"),
  });

  if (!response) {
    return { status: "failed" };
  }

  const saved = writingDraftSchema.safeParse(await response.json().catch(() => null));

  if (!saved.success) {
    return { status: response.status === HTTP_CONFLICT ? "closed" : "failed" };
  }

  return { draft: saved.data, status: response.ok ? "saved" : "conflict" };
}

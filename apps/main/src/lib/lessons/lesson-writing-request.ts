"use client";

import { postFromBrowser } from "@/lib/api/browser-api";
import { readRefusedLimit } from "@/lib/api/refused-limit";
import { ensureGuestSession } from "@/lib/guest/ensure-guest-session";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/error-codes";
import { type LessonLimit } from "@zoonk/learn/help-limit";
import { getString, isJsonObject } from "@zoonk/utils/json";

export type LessonWritingAnswer =
  | { generationId: string; status: "writing" }
  | { limit: LessonLimit; status: "refused" }
  | { status: "failed" }
  | { status: "plusRequired" }
  | { status: "ready" }
  | { status: "setAside" };

const HTTP_CONFLICT = 409;

function readAnswer({
  body,
  response,
}: {
  body: unknown;
  response: Response;
}): LessonWritingAnswer {
  const code = isJsonObject(body) ? getString(body.error, "code") : null;

  if (code === LESSON_PLAYER_ERROR_CODES.plusRequired) {
    return { status: "plusRequired" };
  }

  const limit = readRefusedLimit({ body, status: response.status });

  if (limit) {
    return { limit, status: "refused" };
  }

  if (response.status === HTTP_CONFLICT && code === LESSON_PLAYER_ERROR_CODES.lessonSetAside) {
    return { status: "setAside" };
  }

  if (!response.ok) {
    return { status: "failed" };
  }

  if (getString(body, "status") === "ready") {
    return { status: "ready" };
  }

  const generationId = getString(body, "generationId");
  return generationId ? { generationId, status: "writing" } : { status: "failed" };
}

export async function askToWriteLesson(lessonId: string): Promise<LessonWritingAnswer> {
  if (!(await ensureGuestSession())) {
    return { status: "failed" };
  }

  const response = await postFromBrowser({
    path: `/v1/library/lessons/${encodeURIComponent(lessonId)}/generations`,
  });

  if (!response) {
    return { status: "failed" };
  }

  const body: unknown = await response.json().catch(() => null);
  return readAnswer({ body, response });
}

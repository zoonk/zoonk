"use client";

import { postFromBrowser } from "@/lib/api/browser-api";
import { readRefusedLimit } from "@/lib/api/refused-limit";
import { ensureGuestSession } from "@/lib/guest/ensure-guest-session";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/contract";
import { type LessonLimit } from "@zoonk/learn/help-limit";
import { getString, isJsonObject } from "@zoonk/utils/json";

/**
 * What asking for a lesson's content answered: `writing` once a run writes it (followed by its
 * id), `ready` when it's written, `refused` when the learner's allowance says not now (and why),
 * `setAside` when every draft failed its checks, so nothing writes it again, and `failed` when
 * the request didn't go through.
 */
export type LessonWritingAnswer =
  | { generationId: string; status: "writing" }
  | { limit: LessonLimit; status: "refused" }
  | { status: "failed" }
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
  const limit = readRefusedLimit({ body, status: response.status });

  if (limit) {
    return { limit, status: "refused" };
  }

  const code = isJsonObject(body) ? getString(body.error, "code") : null;

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

/**
 * Asks the API to write the lesson now, or to follow the run already writing it, from the
 * learner's tap. A visitor who pressed "Start this lesson" without a session becomes a guest
 * first (behind BotID), so the guest's allowance decides whether a new lesson may be written.
 */
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

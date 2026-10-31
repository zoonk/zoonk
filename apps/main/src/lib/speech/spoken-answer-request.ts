"use client";

import { postFromBrowser } from "@/lib/api/browser-api";
import { readRefusedLimit } from "@/lib/api/refused-limit";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/error-codes";
import { type SpokenAnswerGrade } from "@zoonk/core/library/language/spoken-answer-contract";
import { type SpokenAnswerOutcome } from "@zoonk/player/lesson/types";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";

async function readBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

async function toSpokenAnswerOutcome(response: Response): Promise<SpokenAnswerOutcome> {
  const body = await readBody(response);

  if (response.ok) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The API validates successful responses with spokenAnswerGradeSchema.
    const grade = body as SpokenAnswerGrade | null;
    return grade ? { grade, status: "graded" } : { status: "failed" };
  }

  if (isJsonObject(body) && getString(body.error, "code") === LESSON_PLAYER_ERROR_CODES.noSpeech) {
    return { status: "noSpeech" };
  }

  return readRefusedLimit({ body, status: response.status }) ?? { status: "failed" };
}

/** From the browser: transcribing takes a second or more, which would hold up the lesson's Server Actions. */
export async function requestSpokenGrade({
  audio,
  durationMs,
  stepId,
  studySessionId,
}: {
  audio: Blob;
  durationMs: number;
  stepId: string;
  studySessionId: string | null;
}): Promise<SpokenAnswerOutcome> {
  const form = new FormData();
  form.set("audio", audio);
  form.set("durationMs", String(Math.round(durationMs)));
  form.set("timeZone", getLocalTimeZone());

  if (studySessionId) {
    form.set("studySessionId", studySessionId);
  }

  const response = await postFromBrowser({
    body: form,
    path: `/v1/steps/${encodeURIComponent(stepId)}/spoken-answers`,
  });

  return response ? toSpokenAnswerOutcome(response) : { status: "failed" };
}

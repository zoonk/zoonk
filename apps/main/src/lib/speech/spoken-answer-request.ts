"use client";

import { postFromBrowser } from "@/lib/api/browser-api";
import { LESSON_PLAYER_ERROR_CODES } from "@zoonk/core/lesson-player/contract";
import { spokenAnswerGradeSchema } from "@zoonk/core/library/language/spoken-answer-contract";
import { type SpokenAnswerOutcome } from "@zoonk/player/lesson/types";
import { getUsageRefusal } from "@zoonk/player/usage-refusal";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";

async function readBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

/**
 * What `POST /v1/steps/{stepId}/spoken-answers` answered, as the speaking screen shows it: the
 * grade, nothing heard, a slow-down or today's help used up; anything else is a failure the
 * screen offers to try again.
 */
async function toSpokenAnswerOutcome(response: Response): Promise<SpokenAnswerOutcome> {
  const body = await readBody(response);

  if (response.ok) {
    const grade = spokenAnswerGradeSchema.safeParse(body);
    return grade.success ? { grade: grade.data, status: "graded" } : { status: "failed" };
  }

  if (isJsonObject(body) && getString(body.error, "code") === LESSON_PLAYER_ERROR_CODES.noSpeech) {
    return { status: "noSpeech" };
  }

  const refusal = getUsageRefusal(body);

  if (refusal?.kind === "slowDown") {
    return { retryAfterSeconds: refusal.retryAfterSeconds, status: "slowDown" };
  }

  return refusal
    ? { period: refusal.period, status: "limitReached", tier: refusal.tier }
    : { status: "failed" };
}

/**
 * The web player's spoken answers: the recording goes to the API from the browser, which grades
 * it and records the answer. Transcribing takes a second or more, so it never holds up the
 * lesson's Server Actions, such as checking a typed answer. A lesson played as a session block
 * sends its session.
 */
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

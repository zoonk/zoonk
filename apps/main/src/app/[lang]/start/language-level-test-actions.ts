"use server";

import { postAsLearner } from "@/lib/api/learner-api";
import { answerLanguageLevelTest } from "@zoonk/core/language/level-test/answer";
import {
  type LanguageLevelTestView,
  levelTestAnswerInputSchema,
} from "@zoonk/core/language/level-test/contract";
import { finishLanguageLevelTest } from "@zoonk/core/language/level-test/finish";
import { getLanguageLevelTest } from "@zoonk/core/language/level-test/get";
import { gradeLevelTestSpeech } from "@zoonk/core/language/level-test/speech";
import { isUuid } from "@zoonk/utils/uuid";

/** The test's next step; null when the goal can't take it. Read-only: it never writes questions. */
export async function getLevelTestAction(goalId: string): Promise<LanguageLevelTestView | null> {
  const result = await getLanguageLevelTest(goalId);
  return result.status === "ready" ? result.test : null;
}

/**
 * Starts writing the pair's questions in the API's workflow when nothing is writing them (the
 * test says `preparing` with no `startedAt`): the learner's tap to begin or try again, never
 * showing the test. False when it couldn't start, so the screen offers to try again.
 */
export async function startLevelTestBankAction(goalId: string): Promise<boolean> {
  if (!isUuid(goalId)) {
    return false;
  }

  const response = await postAsLearner({
    path: `/v1/goals/${encodeURIComponent(goalId)}/language-level-test/generations`,
  });

  return response.ok;
}

/** One answer; the input is untrusted, so it's parsed with the API's schema. */
export async function answerLevelTestAction(
  goalId: string,
  input: unknown,
): Promise<LanguageLevelTestView | null> {
  const parsed = levelTestAnswerInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const result = await answerLanguageLevelTest({ goalId, input: parsed.data });
  return result.status === "ready" ? result.test : null;
}

/** The sentence out loud, sent as a form with the recording. */
export async function speakLevelTestAction(
  goalId: string,
  form: FormData,
): Promise<LanguageLevelTestView | "noSpeech" | null> {
  const audio = form.get("audio");

  if (!(audio instanceof Blob)) {
    return null;
  }

  const result = await gradeLevelTestSpeech({
    audio: { bytes: new Uint8Array(await audio.arrayBuffer()), mediaType: audio.type },
    goalId,
  });

  if (result.status === "noSpeech") {
    return "noSpeech";
  }

  return result.status === "ready" ? result.test : null;
}

/** Ends the test: the answers so far set each skill's level. */
export async function finishLevelTestAction(goalId: string): Promise<boolean> {
  const result = await finishLanguageLevelTest(goalId);
  return result.status === "ready";
}

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
import { getSession } from "@zoonk/core/users/session";
import { type LevelTestFinish } from "@zoonk/learn/onboarding/actions";
import { getCertificateLinks } from "@zoonk/utils/certificate-links";
import { getBaseUrl } from "@zoonk/utils/origin";
import { isUuid } from "@zoonk/utils/uuid";

/** The test's next step; null when the goal can't take it. Read-only: it never writes questions. */
export async function getLevelTestAction(goalId: string): Promise<LanguageLevelTestView | null> {
  const result = await getLanguageLevelTest(goalId);
  return result.status === "ready" ? result.test : null;
}

/** Only from the learner's tap to begin or try again, never from showing the test. */
export async function startLevelTestBankAction(goalId: string): Promise<boolean> {
  if (!isUuid(goalId)) {
    return false;
  }

  const response = await postAsLearner({
    path: `/v1/goals/${encodeURIComponent(goalId)}/language-level-test/generations`,
  });

  return response.ok;
}

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

export async function speakLevelTestAction(
  goalId: string,
  form: FormData,
): Promise<LanguageLevelTestView | "noSpeech" | "signUpRequired" | null> {
  const audio = form.get("audio");

  if (!(audio instanceof Blob)) {
    return null;
  }

  const result = await gradeLevelTestSpeech({
    audio: { bytes: new Uint8Array(await audio.arrayBuffer()), mediaType: audio.type },
    goalId,
  });

  if (result.status === "noSpeech" || result.status === "signUpRequired") {
    return result.status;
  }

  return result.status === "ready" ? result.test : null;
}

/** The placement's links come from this page's own origin, so a preview's point at the preview. */
export async function finishLevelTestAction(goalId: string): Promise<LevelTestFinish> {
  const [result, session] = await Promise.all([finishLanguageLevelTest(goalId), getSession()]);

  if (result.status !== "ready") {
    return null;
  }

  const facts = result.certificate;

  return {
    placement: facts && {
      account: session?.user.isAnonymous ? "guest" : "account",
      facts,
      links: getCertificateLinks({ ...facts, origin: getBaseUrl() }),
    },
  };
}

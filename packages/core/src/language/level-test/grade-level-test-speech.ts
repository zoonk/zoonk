import "server-only";
import { claimAssist } from "../../entitlements/claim-usage";
import { type RefusedUsage } from "../../entitlements/contract";
import {
  type SpokenAudio,
  hearSpokenSentence,
  isValidSpokenAudio,
} from "../../library/language/_utils/hear-spoken-sentence";
import { type SpokenWordResult } from "../../library/language/spoken-answer-match";
import { getSession } from "../../users/get-session";
import {
  getTestStart,
  loadLevelTestContext,
  saveLevelTestProgress,
  toLevelTestView,
} from "./_utils/level-test-state";
import { type LanguageLevelTestView } from "./level-test-contract";
import { getNextLevelTestStep } from "./level-test-rules";

export type GradeLevelTestSpeechResult =
  | RefusedUsage
  | {
      heard: { score: number; transcript: string; words: SpokenWordResult[] };
      status: "ready";
      test: LanguageLevelTestView;
    }
  | {
      status:
        | "invalid"
        | "invalidAudio"
        | "noSpeech"
        | "notFound"
        | "notLanguage"
        | "notReady"
        | "unauthorized";
    };

/**
 * The level test's one sentence out loud: an audio model checks word by word whether a listener
 * would understand it (an accent never counts against it), and the result sets the speaking level.
 * The audio only goes to the model and is never kept.
 */
export async function gradeLevelTestSpeech({
  audio,
  goalId,
}: {
  audio: SpokenAudio;
  goalId: string;
}): Promise<GradeLevelTestSpeechResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isValidSpokenAudio(audio)) {
    return { status: "invalidAudio" };
  }

  const userId = session.user.id;

  const context = await loadLevelTestContext(goalId);

  if (context.status !== "ready") {
    return context;
  }

  const { bank, owned, progress } = context;

  if (!bank) {
    return { status: "notReady" };
  }

  const step = getNextLevelTestStep({ bank, progress, start: getTestStart(owned.goal) });

  if (step.kind !== "speaking") {
    return { status: "invalid" };
  }

  const usage = await claimAssist();

  if (usage.status !== "allowed") {
    return usage;
  }

  const { match, transcript } = await hearSpokenSentence({
    audio,
    check: "thorough",
    expected: step.speaking.sentence,
    language: owned.goal.targetLanguage,
    learnerLanguage: owned.goal.language,
    userId,
  });

  if (!match.normalizedHeard) {
    return { status: "noSpeech" };
  }

  const next = { ...progress, speaking: { level: step.speaking.level, score: match.score } };
  await saveLevelTestProgress({ goal: owned.goal, progress: next });

  return {
    heard: { score: match.score, transcript, words: match.words },
    status: "ready",
    test: toLevelTestView({ bank, goal: owned.goal, progress: next }),
  };
}

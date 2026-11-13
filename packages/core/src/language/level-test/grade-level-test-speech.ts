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
  isFixedDuringTest,
  loadLevelTestContext,
  saveLevelTestProgress,
  toLevelTestView,
} from "./_utils/level-test-state";
import { type LanguageLevelTestView } from "./level-test-contract";
import { levelTestPart } from "./level-test-parts";
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

  if (!(await isValidSpokenAudio(audio))) {
    return { status: "invalidAudio" };
  }

  const userId = session.user.id;

  const context = await loadLevelTestContext(goalId);

  if (context.status !== "ready") {
    return context;
  }

  const { bank, bankId, owned, progress } = context;

  if (!bank || !bankId) {
    return { status: "notReady" };
  }

  const step = getNextLevelTestStep({ bank, progress, start: progress.start });

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

  // A sentence fixed while the learner read it isn't scored: the test asks it again as it is now.
  const excused =
    !match.isCorrect &&
    (await isFixedDuringTest({
      bankId,
      part: levelTestPart({ kind: "speaking", level: step.speaking.level }),
      progress,
    }));

  const next = excused
    ? progress
    : { ...progress, speaking: { level: step.speaking.level, score: match.score } };

  if (
    !excused &&
    !(await saveLevelTestProgress({ from: progress, goal: owned.goal, progress: next }))
  ) {
    return { status: "invalid" };
  }

  return {
    heard: { score: match.score, transcript, words: match.words },
    status: "ready",
    test: await toLevelTestView({
      bank,
      bankWrittenAt: context.bankWrittenAt,
      goal: owned.goal,
      progress: next,
    }),
  };
}

import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal } from "@zoonk/db";
import { parseCefrScore } from "@zoonk/utils/cefr";
import { isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { findSpeechClip, toSpeechClip } from "../../../audio/_utils/speech-clips";
import { type SpeechClip } from "../../../audio/speech-clip-contract";
import { getSpeechClipKey } from "../../../audio/speech-clip-key";
import { findOwnedGoal } from "../../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { readGoalDetails } from "../../_utils/language-goal";
import {
  LEVEL_TEST_PREPARING_SECONDS,
  type LanguageLevelTestView,
  type LevelTestBank,
  type LevelTestProgress,
  type LevelTestQuestion,
  levelTestProgressSchema,
} from "../level-test-contract";
import {
  LEVEL_TEST_TOTAL,
  getLevelTestScores,
  getNextLevelTestStep,
  listLevelTestLevels,
} from "../level-test-rules";
import { type LevelTestBankState, loadLevelTestBank } from "./level-test-bank";

const DEFAULT_START = 1;

/** About how long the bank's run takes to voice its clips, retries included, after the questions. */
const AUDIO_PENDING_MS = 90_000;

export type LevelTestGoal = { goal: Goal & { targetLanguage: string }; userId: string };

export type LevelTestContext =
  | {
      bank: LevelTestBank | null;
      bankStartedAt: Date | null;
      bankWrittenAt: Date | null;
      owned: LevelTestGoal;
      progress: LevelTestProgress;
      status: "ready";
    }
  | { status: "notFound" | "notLanguage" | "unauthorized" };

/** The starting level must not follow a level previously set by this same test. */
export function readLevelTestProgress(goal: Pick<Goal, "details">): LevelTestProgress {
  const details = readGoalDetails(goal);
  const parsed = levelTestProgressSchema.safeParse(details.levelTest);
  const stored = parsed.success ? parsed.data : levelTestProgressSchema.parse({});

  return { ...stored, start: stored.start ?? parseCefrScore(details.level) ?? DEFAULT_START };
}

/** Returns false if progress changed since `from`; callers must reload rather than overwrite it. */
export async function saveLevelTestProgress({
  from,
  goal,
  progress,
}: {
  from: LevelTestProgress;
  goal: Pick<Goal, "id" | "userId">;
  progress: LevelTestProgress;
}): Promise<boolean> {
  return writeLearnerChange({ userId: goal.userId }, async (tx) => {
    const current = await tx.goal.findUniqueOrThrow({ where: { id: goal.id } });

    if (!isDeepStrictEqual(readLevelTestProgress(current), from)) {
      return unchanged(false);
    }

    await tx.goal.update({
      data: { details: { ...readGoalDetails(current), levelTest: progress } },
      where: { id: goal.id },
    });

    return true;
  });
}

export async function loadLevelTestContext(goalId: string): Promise<LevelTestContext> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;
  const { targetLanguage } = goal;

  if (goal.kind !== "language" || !targetLanguage) {
    return { status: "notLanguage" };
  }

  const state: LevelTestBankState = await loadLevelTestBank({
    language: goal.language,
    targetLanguage,
  });

  return {
    bank: state.status === "ready" ? state.bank : null,
    bankStartedAt: state.status === "preparing" ? state.startedAt : null,
    bankWrittenAt: state.status === "ready" ? state.writtenAt : null,
    owned: { goal: { ...goal, targetLanguage }, userId },
    progress: readLevelTestProgress(goal),
    status: "ready",
  };
}

async function findQuestionAudio({
  bankWrittenAt,
  language,
  question,
}: {
  bankWrittenAt: Date | null;
  language: string;
  question: LevelTestQuestion;
}): Promise<{ audio: SpeechClip | null; audioPending: boolean }> {
  if (question.skill !== "listening" || !isTTSSupportedLanguage(language)) {
    return { audio: null, audioPending: false };
  }

  const clip = await findSpeechClip(getSpeechClipKey({ language, text: question.passage }));

  if (clip) {
    return { audio: toSpeechClip(clip), audioPending: false };
  }

  const writtenAt = bankWrittenAt?.getTime() ?? 0;
  return { audio: null, audioPending: Date.now() - writtenAt < AUDIO_PENDING_MS };
}

export async function toLevelTestView({
  bank,
  bankStartedAt = null,
  bankWrittenAt,
  goal,
  lastCorrect = null,
  progress,
}: {
  bank: LevelTestBank | null;
  bankStartedAt?: Date | null;
  bankWrittenAt: Date | null;
  goal: LevelTestGoal["goal"];
  lastCorrect?: boolean | null;
  progress: LevelTestProgress;
}): Promise<LanguageLevelTestView> {
  if (!bank) {
    return {
      expectedSeconds: LEVEL_TEST_PREPARING_SECONDS,
      startedAt: bankStartedAt?.toISOString() ?? null,
      status: "preparing",
    };
  }

  const { start } = progress;
  const step = getNextLevelTestStep({ bank, progress, start });
  const scores = getLevelTestScores({ bank, progress, start });

  const next =
    step.kind === "question"
      ? {
          kind: "question" as const,
          question: {
            ...(await findQuestionAudio({
              bankWrittenAt,
              language: goal.targetLanguage,
              question: step.question,
            })),
            id: step.question.id,
            level: step.question.level,
            options: step.question.options,
            passage: step.question.passage,
            question: step.question.question,
            skill: step.question.skill,
          },
        }
      : step;

  return {
    answered: progress.answers.length + (progress.speaking ? 1 : 0),
    lastCorrect,
    levels: listLevelTestLevels(scores),
    next,
    status: "ready",
    targetLanguage: goal.targetLanguage,
    total: LEVEL_TEST_TOTAL,
  };
}

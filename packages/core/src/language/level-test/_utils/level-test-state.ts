import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal } from "@zoonk/db";
import { parseCefrScore } from "@zoonk/utils/cefr";
import { isJsonObject } from "@zoonk/utils/json";
import { isTTSSupportedLanguage, usesNonLatinScript } from "@zoonk/utils/languages";
import { findSpeechClip, toSpeechClip } from "../../../audio/_utils/speech-clips";
import { type SpeechClip } from "../../../audio/speech-clip-contract";
import { getSpeechClipKey } from "../../../audio/speech-clip-key";
import { findOwnedGoal } from "../../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../../learner/_utils/write-learner-change";
import { findRowsFixedSince } from "../../../staff/content-fixes/fixed-since";
import { readGoalDetails } from "../../_utils/language-goal";
import {
  LEVEL_TEST_PREPARING_SECONDS,
  type LanguageLevelTestView,
  type LevelTestBank,
  type LevelTestConfirmation,
  type LevelTestProgress,
  type LevelTestQuestion,
  levelTestProgressSchema,
} from "../level-test-contract";
import {
  getLevelTestFloors,
  getNextLevelTestStep,
  levelTestTotal,
  listLevelTestLevels,
} from "../level-test-rules";
import {
  readLevelTestAttempts,
  readLevelTestDetails,
  readLevelTestSummary,
} from "../read-level-test-summary";
import { type LevelTestBankState, loadLevelTestBank } from "./level-test-bank";
import { type LevelTestAnswerRecord, recordLevelTestAnswer } from "./level-test-records";
import { withLevelTestChange } from "./level-test-result-change";
import { showLevelTestOptions } from "./level-test-shown-order";
import { getLevelTestStartScore } from "./level-test-start-score";

/** About how long the bank's run takes to voice its clips, retries included, after the questions. */
const AUDIO_PENDING_MS = 90_000;

export type LevelTestGoal = { goal: Goal & { targetLanguage: string }; userId: string };

export type LevelTestContext =
  | {
      bank: LevelTestBank | null;
      bankId: string | null;
      bankRunId: string | null;
      bankStartedAt: Date | null;
      bankWrittenAt: Date | null;
      owned: LevelTestGoal;
      progress: LevelTestProgress;
      status: "ready";
    }
  | { status: "notFound" | "notLanguage" | "unauthorized" };

/** Tests finished before their scores were saved keep the levels their finish wrote. */
function readFinishedLabels(skillLevels: unknown): LevelTestProgress["scores"] {
  const labels = isJsonObject(skillLevels) ? skillLevels : {};
  const listening = parseCefrScore(labels.listening);
  const reading = parseCefrScore(labels.reading);
  const speaking = parseCefrScore(labels.speaking);

  return {
    ...(listening !== null && { listening }),
    ...(reading !== null && { reading }),
    ...(speaking !== null && { speaking }),
  };
}

/** The starting level must not follow a level previously set by this same test. */
export function readLevelTestProgress(goal: Pick<Goal, "details">): LevelTestProgress;
export function readLevelTestProgress(
  goal: Pick<Goal, "details">,
  attemptId: string | undefined,
): LevelTestProgress | null;
export function readLevelTestProgress(
  goal: Pick<Goal, "details">,
  attemptId?: string,
): LevelTestProgress | null {
  if (attemptId) {
    const { attempt, completedAttempt } = readLevelTestAttempts(goal);

    const stored = [attempt, completedAttempt].find(
      (candidate) => candidate?.attemptId === attemptId,
    );

    return stored ? { ...stored, start: stored.start ?? 1 } : null;
  }

  const details = readGoalDetails(goal);
  const parsed = levelTestProgressSchema.safeParse(details.levelTest);
  const stored = parsed.success ? parsed.data : levelTestProgressSchema.parse({});

  const scores =
    stored.scores ??
    (stored.result || stored.placement ? readFinishedLabels(details.skillLevels) : undefined);

  return {
    ...stored,
    ...(scores && { scores }),
    start: stored.start ?? getLevelTestStartScore({ level: details.level }),
  };
}

export function levelTestDetailsWithProgress(
  goal: Pick<Goal, "details">,
  progress: LevelTestProgress,
) {
  const levelTest = readLevelTestDetails(goal);

  return {
    ...readGoalDetails(goal),
    levelTest: progress.attemptId
      ? { ...levelTest, attempt: progress }
      : { ...levelTest, ...progress },
  };
}

export function canWriteLevelTest(
  goal: Pick<Goal, "details">,
  progress: LevelTestProgress,
): boolean {
  const { attempt, testOut } = readLevelTestAttempts(goal);
  return progress.attemptId ? attempt?.attemptId === progress.attemptId : !attempt && !testOut;
}

function bankForAttempt(
  bank: LevelTestBank,
  goal: Pick<Goal, "details">,
  progress: LevelTestProgress,
) {
  const used = new Set(readLevelTestAttempts(goal).usedConfirmations);

  return {
    ...bank,
    confirmations: progress.attemptId
      ? bank.confirmations?.filter(
          ({ addedAt, id }) =>
            !used.has(id) && (!addedAt || !progress.startedAt || addedAt <= progress.startedAt),
        )
      : [],
  };
}

/** Returns false if progress changed since `from`; callers must reload rather than overwrite it. */
export async function saveLevelTestProgress({
  from,
  goal,
  progress,
  record,
}: {
  from: LevelTestProgress;
  goal: Pick<Goal, "id" | "userId">;
  progress: LevelTestProgress;
  record?: LevelTestAnswerRecord;
}): Promise<boolean> {
  return writeLearnerChange({ userId: goal.userId }, async (tx) => {
    const current = await tx.goal.findUniqueOrThrow({ where: { id: goal.id } });

    if (
      !canWriteLevelTest(current, from) ||
      !isDeepStrictEqual(readLevelTestProgress(current, from.attemptId), from)
    ) {
      return unchanged(false);
    }

    await tx.goal.update({
      data: { details: levelTestDetailsWithProgress(current, progress) },
      where: { id: goal.id },
    });

    if (record) {
      await recordLevelTestAnswer(tx, record);
    }

    return true;
  });
}

export async function loadLevelTestContext(
  goalId: string,
  attemptId?: string,
): Promise<LevelTestContext> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;
  const { targetLanguage } = goal;

  if (goal.kind !== "language" || !targetLanguage) {
    return { status: "notLanguage" };
  }

  const progress = readLevelTestProgress(goal, attemptId);

  if (!progress) {
    return { status: "notFound" };
  }

  const state: LevelTestBankState = await loadLevelTestBank(
    { language: goal.language, targetLanguage },
    Boolean(progress.attemptId && !progress.result),
  );

  return {
    bank: state.status === "ready" ? bankForAttempt(state.bank, goal, progress) : null,
    bankId: state.status === "ready" ? state.id : null,
    bankRunId: state.status === "ready" ? state.runId : null,
    bankStartedAt: state.status === "preparing" ? state.startedAt : null,
    bankWrittenAt: state.status === "ready" ? state.writtenAt : null,
    owned: { goal: { ...goal, targetLanguage }, userId },
    progress,
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
  question: LevelTestQuestion | LevelTestConfirmation;
}): Promise<{ audio: SpeechClip | null; audioPending: boolean }> {
  if (question.skill !== "listening" || !isTTSSupportedLanguage(language)) {
    return { audio: null, audioPending: false };
  }

  const clip = await findSpeechClip(getSpeechClipKey({ language, text: question.passage }));

  if (clip) {
    return { audio: toSpeechClip(clip), audioPending: false };
  }

  const writtenAt =
    "addedAt" in question && question.addedAt
      ? Date.parse(question.addedAt)
      : (bankWrittenAt?.getTime() ?? 0);

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
  const result = progress.attemptId && (progress.result ?? readLevelTestSummary(goal).result);

  const attempt = progress.attemptId && {
    attemptId: progress.attemptId,
    length: progress.length,
    result: result ? await withLevelTestChange(goal.id, result) : null,
    testOutLevel: progress.testOutLevel,
  };

  if (!bank) {
    return {
      ...attempt,
      expectedSeconds: LEVEL_TEST_PREPARING_SECONDS,
      showAlphabetNote: usesNonLatinScript(goal.targetLanguage),
      startedAt: bankStartedAt?.toISOString() ?? null,
      status: "preparing",
    };
  }

  const { start } = progress;
  const step = getNextLevelTestStep({ bank, progress, start });
  const scores = progress.scores ?? getLevelTestFloors({ bank, progress, start });

  const next =
    step.kind === "question" || step.kind === "confirmation"
      ? {
          kind: step.kind,
          question: {
            ...(await findQuestionAudio({
              bankWrittenAt,
              language: goal.targetLanguage,
              question: step.question,
            })),
            id: step.question.id,
            level: step.question.level,
            options: showLevelTestOptions({
              attemptId: progress.attemptId,
              goalId: goal.id,
              question: step.question,
            }),
            passage: step.question.passage,
            question: step.question.question,
            skill: step.question.skill,
          },
        }
      : step;

  return {
    ...attempt,
    answered: progress.answers.length + (progress.speaking ? 1 : 0),
    lastCorrect,
    levels: listLevelTestLevels(scores),
    next,
    showAlphabetNote: usesNonLatinScript(goal.targetLanguage),
    status: "ready",
    targetLanguage: goal.targetLanguage,
    total: levelTestTotal(progress.length),
  };
}

/**
 * Whether a fix changed this part of the bank after the learner's test began, so an answer to it
 * may have been given to the old wording and doesn't count. Before its first answer, the test may
 * have been on screen since the goal was made.
 */
export async function isFixedDuringTest({
  bankId,
  goal,
  part,
  progress,
}: {
  bankId: string;
  goal: Pick<Goal, "createdAt">;
  part: string;
  progress: Pick<LevelTestProgress, "startedAt">;
}): Promise<boolean> {
  const fixed = await findRowsFixedSince({
    rows: [{ id: bankId, model: "LanguageLevelTest", parts: [part] }],
    startedAt: progress.startedAt ? new Date(progress.startedAt) : goal.createdAt,
  });

  return fixed.length > 0;
}

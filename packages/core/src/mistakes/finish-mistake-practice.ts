import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { trackLearnerEvents } from "../analytics/track-learner-event";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../cache/tags";
import { findOwnedGoal } from "../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { celebrateProgress } from "../milestones/celebrate-progress";
import {
  type ProgressChange,
  type ProgressLock,
  applySessionProgress,
} from "../sessions/_utils/session-progress";
import { getAnswersEnergyDelta, scoreAnswers } from "../sessions/brain-power";
import { type MissionMomentView } from "../sessions/completion-contract";
import { finishStudyBlock } from "../sessions/finish-study-block";
import { withActivityMissionMoment } from "../sessions/missions/activity-mission-result";
import { settleLearnerMissions } from "../sessions/missions/settle-learner-missions";
import { type ProgressCelebration } from "../sessions/progress-celebration";
import { getCompletionEnergyContext } from "../stats/completion-energy";
import { getLedgerLocalTime, recordLearningEvent } from "../stats/record-learning-event";
import { getSession } from "../users/get-session";
import { findPracticeMock, mockMistakeWhere } from "./_utils/mock-practice";
import { findPracticeBlock } from "./_utils/practice-block";
import { readPracticeMistakeId } from "./_utils/practice-claim";
import { hasPracticeRemaining } from "./_utils/practice-entries";
import {
  MISTAKE_PRACTICE_EVENT,
  type PracticeAnswer,
  getPracticeTime,
  loadCountedRuns,
  loadPracticeAnswers,
  matchRun,
  toRunContentIds,
} from "./_utils/practice-runs";
import { type MistakePracticeFinishInput } from "./contract";
import { getPracticeTimeZone } from "./mistake-availability";

type MistakePracticeSummary = ProgressCelebration & {
  brainPower: number;
  correct: number;
  hasMorePractice: boolean;
  /** The missions the run completed, for the end of its screen; null when it completed none. */
  missionMoment: MissionMomentView | null;
  seconds: number;
  total: number;
};

type PracticeRunTotals = Omit<
  MistakePracticeSummary,
  "ceremony" | "certificates" | "hasMorePractice" | "missionMoment" | "reached"
>;

export type FinishMistakePracticeResult =
  | { result: MistakePracticeSummary; status: "ready" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "unauthorized" };

async function resolveGoal(goalId: string | undefined): Promise<Goal | "notFound" | null> {
  if (!goalId) {
    return null;
  }

  const owned = await findOwnedGoal(goalId);
  return owned.status === "ready" ? owned.goal : "notFound";
}

function getRunTotals({ answers, endedAt }: { answers: readonly PracticeAnswer[]; endedAt: Date }) {
  const { brainPower } = scoreAnswers({
    answers: answers.map((answer) => ({
      isCorrect: answer.isCorrect,
      material: "due" as const,
      priorRightAnswers: 0,
    })),
  });

  return {
    brainPower,
    correct: answers.filter((answer) => answer.isCorrect).length,
    ...getPracticeTime({ answers, endedAt }),
    total: answers.length,
  };
}

type SettleInput = {
  answers: PracticeAnswer[];
  goalId: string | null;
  timeZone: string;
  userId: string;
};

type WriteRunInput = Omit<SettleInput, "answers"> & {
  fresh: readonly PracticeAnswer[];
  lock: ProgressLock;
  run: { brainPower: number; id: string; seconds: number } | null;
  runAnswers: readonly PracticeAnswer[];
};

async function writeRun(
  tx: TransactionClient,
  { fresh, goalId, lock, run, runAnswers, timeZone, userId }: WriteRunInput,
): Promise<{
  progress: { brainPower: ProgressChange; energy: ProgressChange };
  result: PracticeRunTotals;
  runId: string;
}> {
  const totals = getRunTotals({ answers: runAnswers, endedAt: lock.completedAt });
  const correct = fresh.filter((answer) => answer.isCorrect).length;
  const incorrect = fresh.length - correct;
  const energyDelta = getAnswersEnergyDelta({ correct, incorrect });
  const brainPower = Math.max(0, totals.brainPower - (run?.brainPower ?? 0));
  const seconds = Math.max(0, totals.seconds - (run?.seconds ?? 0));

  const progress = await applySessionProgress(tx, {
    completion: run === null,
    delta: {
      brainPower,
      correctAnswers: correct,
      energyDelta,
      incorrectAnswers: incorrect,
      seconds,
    },
    lock,
    userId,
  });

  const counts = {
    contentIds: toRunContentIds(runAnswers),
    correctAnswers: totals.correct,
    endedAt: lock.completedAt,
    incorrectAnswers: totals.total - totals.correct,
  };

  const result = {
    brainPower: (run?.brainPower ?? 0) + brainPower,
    correct: totals.correct,
    seconds: (run?.seconds ?? 0) + seconds,
    total: totals.total,
  };

  if (run) {
    await tx.learningEvent.update({
      data: {
        ...counts,
        brainPower: run.brainPower + brainPower,
        energyDelta: { increment: energyDelta },
        seconds: run.seconds + seconds,
        ...getLedgerLocalTime({ date: lock.completedAt, timeZone }),
      },
      where: { id: run.id },
    });

    return { progress, result, runId: run.id };
  }

  const event = await recordLearningEvent(tx, {
    ...MISTAKE_PRACTICE_EVENT,
    ...counts,
    brainPower,
    energyDelta,
    goalId,
    seconds,
    startedAt: totals.startedAt,
    timeZone,
    titleSnapshot: null,
    userId,
  });

  return { progress, result, runId: event.id };
}

/** Extends a single run row with uncounted answers; an unchanged finish replays its totals. */
function settlePracticeRun({ answers, ...input }: SettleInput) {
  return writeLearnerChange({ userId: input.userId }, async (tx) => {
    const lock = await getCompletionEnergyContext({
      timeZone: input.timeZone,
      transaction: tx,
      userId: input.userId,
    });

    const runs = await loadCountedRuns(tx, {
      since: answers[0]?.answeredAt ?? lock.completedAt,
      userId: input.userId,
    });

    const { fresh, run, runAnswers } = matchRun({ answers, runs });

    if (fresh.length === 0) {
      return unchanged({
        counted: false,
        progress: null,
        result: {
          brainPower: run?.brainPower ?? 0,
          correct: run?.correctAnswers ?? 0,
          seconds: run?.seconds ?? 0,
          total: (run?.correctAnswers ?? 0) + (run?.incorrectAnswers ?? 0),
        },
        runId: run?.id ?? null,
      });
    }

    const recorded = await writeRun(tx, { ...input, fresh, lock, run, runAnswers });
    return { counted: true, ...recorded };
  });
}

async function loadCompletionScope(input: MistakePracticeFinishInput, userId: string) {
  const { blockId, mockId } = input;

  const [block, mock, answers] = await Promise.all([
    blockId ? findPracticeBlock({ blockId, userId }) : null,
    mockId ? findPracticeMock({ mockId, userId }) : null,
    loadPracticeAnswers({ answerIds: input.answerIds, userId }),
  ]);

  if (
    (blockId && (!block || (input.goalId && block.session.goalId !== input.goalId))) ||
    (mockId && (!mock || blockId))
  ) {
    return { status: "notFound" as const };
  }

  const scope = block ? block.session : mock;
  const goal = scope ? scope.goal : await resolveGoal(input.goalId);

  if (goal === "notFound") {
    return { status: "notFound" as const };
  }

  if (!answers || (!block && answers.length === 0)) {
    return { status: "invalid" as const };
  }

  const answerMistakes = new Set(answers.map(({ answer }) => readPracticeMistakeId(answer) ?? ""));

  if (block && [...answerMistakes].some((id) => !block.mistakeIds.includes(id))) {
    return { status: "invalid" as const };
  }

  if (mockId) {
    const matches = await prisma.mistake.count({
      where: { ...(await mockMistakeWhere({ mockId, userId })), id: { in: [...answerMistakes] } },
    });

    if (matches !== answerMistakes.size) {
      return { status: "invalid" as const };
    }
  }

  return { answers, block, goal, status: "ready" as const };
}

/** Send every answer so far after each answer and once more with ended=true on stop; retries count only fresh answers. */
export async function finishMistakePractice(
  input: MistakePracticeFinishInput,
): Promise<FinishMistakePracticeResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const scope = await loadCompletionScope(input, userId);

  if (scope.status !== "ready") {
    return scope;
  }

  const { answers, block, goal } = scope;
  const timeZone = await getPracticeTimeZone({ goal, timeZone: input.timeZone, userId });

  const { counted, progress, result, runId } = await settlePracticeRun({
    answers,
    goalId: goal?.id ?? null,
    timeZone,
    userId,
  });

  if (block) {
    await finishStudyBlock({
      blockId: block.block.id,
      input: { timeZone },
      sessionId: block.session.id,
    });
  }

  const source = runId ? { id: runId, kind: "mistakePractice" } : null;

  const celebration = await celebrateProgress({
    progress,
    settleDay: source ? () => settleLearnerMissions({ source, timeZone, userId }) : undefined,
    userId,
  });

  // Answers count as they come, so a run's last finish usually has nothing new. It expires tags
  // anyway: only that drops the notebook the browser kept, which still shows what the run fixed.
  if (counted || input.ended) {
    revalidateCacheTags([getUserProgressCacheTag(userId)]);
  }

  if (input.ended && result.total > 0) {
    await trackLearnerEvents({
      events: [
        {
          name: "Mistake Practice Finished",
          properties: { correct: result.correct, questions: result.total },
        },
      ],
      goalId: goal?.id ?? null,
      userId,
    });
  }

  const hasMorePractice = await hasPracticeRemaining({ goal, input, timeZone, userId });

  return {
    result: await withActivityMissionMoment({
      result: { ...result, ...celebration, hasMorePractice },
      source,
      timeZone,
      userId,
    }),
    status: "ready",
  };
}

import "server-only";
import { type ExperienceMode, type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { trackLearnerEvents } from "../analytics/track-learner-event";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../cache/tags";
import { findOwnedGoal, getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getLearnerMode } from "../sessions/_utils/session-ledger";
import { type ProgressLock, applySessionProgress } from "../sessions/_utils/session-progress";
import { getAnswersEnergyDelta, scoreAnswers } from "../sessions/brain-power";
import { getCompletionEnergyContext } from "../stats/completion-energy";
import { recordLearningEvent } from "../stats/record-learning-event";
import { getSession } from "../users/get-session";
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

/** What a run earned so far, as the "Practice done" screen shows it. */
type MistakePracticeSummary = {
  brainPower: number;
  correct: number;
  seconds: number;
  total: number;
};

export type FinishMistakePracticeResult =
  | { result: MistakePracticeSummary; status: "ready" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** The goal the run practiced when it was scoped to one; "notFound" when it isn't theirs. */
async function resolveGoal(goalId: string | undefined): Promise<Goal | "notFound" | null> {
  if (!goalId) {
    return null;
  }

  const owned = await findOwnedGoal(goalId);
  return owned.status === "ready" ? owned.goal : "notFound";
}

/**
 * The whole run's totals: Brain Power for mistake drills (due material, with Hyperdrive across the
 * run), right answers, and time from the first question shown.
 */
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
  mode: ExperienceMode | null;
  timeZone: string;
  userId: string;
};

type WriteRunInput = Omit<SettleInput, "answers"> & {
  fresh: readonly PracticeAnswer[];
  lock: ProgressLock;
  run: { brainPower: number; id: string; seconds: number } | null;
  runAnswers: readonly PracticeAnswer[];
};

/**
 * Adds the new answers to today like any question block: what they added to the run's Brain Power
 * and time, their answers and Energy, and a completion when the run is first counted, so the day is
 * a learning day. The run keeps one ledger row, which grows as the run goes on.
 */
async function writeRun(
  tx: TransactionClient,
  { fresh, goalId, lock, mode, run, runAnswers, timeZone, userId }: WriteRunInput,
): Promise<MistakePracticeSummary> {
  const totals = getRunTotals({ answers: runAnswers, endedAt: lock.completedAt });
  const correct = fresh.filter((answer) => answer.isCorrect).length;
  const incorrect = fresh.length - correct;
  const energyDelta = getAnswersEnergyDelta({ correct, incorrect });
  const brainPower = Math.max(0, totals.brainPower - (run?.brainPower ?? 0));
  const seconds = Math.max(0, totals.seconds - (run?.seconds ?? 0));

  await applySessionProgress(tx, {
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

  if (run) {
    await tx.learningEvent.update({
      data: {
        ...counts,
        brainPower: run.brainPower + brainPower,
        energyDelta: { increment: energyDelta },
        seconds: run.seconds + seconds,
      },
      where: { id: run.id },
    });
  } else {
    await recordLearningEvent(tx, {
      ...MISTAKE_PRACTICE_EVENT,
      ...counts,
      brainPower,
      energyDelta,
      goalId,
      mode,
      seconds,
      startedAt: totals.startedAt,
      timeZone,
      titleSnapshot: null,
      userId,
    });
  }

  return {
    brainPower: (run?.brainPower ?? 0) + brainPower,
    correct: totals.correct,
    seconds: (run?.seconds ?? 0) + seconds,
    total: totals.total,
  };
}

/**
 * Counts a run under the learner's progress lock. Apps finish a run as it goes, with every answer
 * so far, so a run left halfway still counts: each finish adds only answers no finish counted yet
 * to the run's row, and one that adds nothing returns what the run earned.
 */
function settlePracticeRun({ answers, ...input }: SettleInput) {
  return prisma.$transaction(async (tx) => {
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
      return {
        counted: false,
        result: {
          brainPower: run?.brainPower ?? 0,
          correct: run?.correctAnswers ?? 0,
          seconds: run?.seconds ?? 0,
          total: (run?.correctAnswers ?? 0) + (run?.incorrectAnswers ?? 0),
        },
      };
    }

    const result = await writeRun(tx, { ...input, fresh, lock, run, runAnswers });
    return { counted: true, result };
  });
}

/**
 * Finishes a "Practice mistakes" run with every answer given so far: after each answer, and once
 * `ended` at its end or when the learner stops early. The run counts toward today like any
 * practice, and finishing again counts only answers no finish counted yet.
 */
export async function finishMistakePractice(
  input: MistakePracticeFinishInput,
): Promise<FinishMistakePracticeResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const [goal, answers, mode] = await Promise.all([
    resolveGoal(input.goalId),
    loadPracticeAnswers({ answerIds: input.answerIds, userId }),
    getLearnerMode(userId),
  ]);

  if (goal === "notFound") {
    return { status: "notFound" };
  }

  if (!answers) {
    return { status: "invalid" };
  }

  const { counted, result } = await settlePracticeRun({
    answers,
    goalId: goal?.id ?? null,
    mode,
    timeZone: getAnswerTimeZone({ goal, timeZone: input.timeZone }),
    userId,
  });

  if (counted) {
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

  return { result, status: "ready" };
}

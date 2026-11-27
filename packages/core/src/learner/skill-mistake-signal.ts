import { type Attempt, type MistakeCause } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";

const ATTEMPT_WINDOW_DAYS = 28;
const MAX_COUNTED_ANSWERS = 6;
const REQUIRED_MISSES = 2;
const REQUIRED_MISS_SHARE = 0.5;
const RIGHT_DAYS_TO_RECOVER = 2;
const SECOND_TAKE_DELAY_DAYS = 7;

export const TEACHING_MISS_CAUSES: readonly MistakeCause[] = ["gap", "trap"];

export type SkillSignalAttempt = Pick<
  Attempt,
  | "answeredAt"
  | "cause"
  | "evidence"
  | "id"
  | "isCorrect"
  | "itemId"
  | "localDate"
  | "mockExamId"
  | "stepId"
>;

export type SkillTeachingHistory = {
  helpedAt: Date | null;
  replayedAt: Date | null;
  secondTakeAt: Date | null;
};

export type SkillMistakeSignal = SkillTeachingHistory & {
  dueSecondTake: boolean;
  latestMiss: Pick<
    SkillSignalAttempt,
    "answeredAt" | "id" | "itemId" | "mockExamId" | "stepId"
  > | null;
  stage: "none" | "replay" | "secondTake";
  stuck: boolean;
};

export function getSkillSignalWindowStart(now: Date): Date {
  return new Date(now.getTime() - ATTEMPT_WINDOW_DAYS * MS_PER_DAY);
}

function counts(attempt: SkillSignalAttempt): boolean {
  if (!attempt.evidence) {
    return false;
  }

  return attempt.isCorrect
    ? attempt.evidence === "independent"
    : attempt.cause !== null && TEACHING_MISS_CAUSES.includes(attempt.cause);
}

function recentCounts({
  attempts,
  helpedAt,
  now,
}: {
  attempts: readonly SkillSignalAttempt[];
  helpedAt: Date | null;
  now: Date;
}) {
  const start = getSkillSignalWindowStart(now);
  const questionsByDay = new Set<string>();

  const recent = attempts
    .filter(
      (attempt) =>
        attempt.answeredAt >= start &&
        (!helpedAt || attempt.answeredAt > helpedAt) &&
        attempt.answeredAt <= now &&
        counts(attempt),
    )
    .toSorted(
      (first, second) =>
        second.answeredAt.getTime() - first.answeredAt.getTime() ||
        second.id.localeCompare(first.id),
    );

  return recent
    .filter((attempt) => {
      const question = attempt.stepId ?? attempt.itemId ?? attempt.id;
      const key = `${attempt.localDate.getTime()}:${question}`;

      if (questionsByDay.has(key)) {
        return false;
      }

      questionsByDay.add(key);
      return true;
    })
    .slice(0, MAX_COUNTED_ANSWERS);
}

function activeEpisode(recent: readonly SkillSignalAttempt[]) {
  const rightDays = new Set<number>();
  const rightRun = { start: 0 };

  for (const [index, attempt] of recent.entries()) {
    if (attempt.isCorrect) {
      if (rightDays.size === 0) {
        rightRun.start = index;
      }

      rightDays.add(attempt.localDate.getTime());

      if (rightDays.size >= RIGHT_DAYS_TO_RECOVER) {
        return recent.slice(0, rightRun.start);
      }
    } else {
      rightDays.clear();
    }
  }

  return recent;
}

function hasRepeatedMisses(misses: readonly SkillSignalAttempt[]): boolean {
  const days = new Set(misses.map((miss) => miss.localDate.getTime()));
  const mockQuestions = new Map<string, Set<string>>();

  if (days.size >= REQUIRED_MISSES) {
    return true;
  }

  for (const { itemId, mockExamId } of misses) {
    if (mockExamId && itemId) {
      const questions = mockQuestions.get(mockExamId) ?? new Set<string>();
      questions.add(itemId);
      mockQuestions.set(mockExamId, questions);
    }
  }

  return [...mockQuestions.values()].some((questions) => questions.size >= REQUIRED_MISSES);
}

function getStage({ replayedAt, secondTakeAt }: SkillTeachingHistory): SkillMistakeSignal["stage"] {
  if (secondTakeAt) {
    return "secondTake";
  }

  return replayedAt ? "replay" : "none";
}

export function getSkillMistakeSignal({
  attempts,
  history,
  now,
}: {
  attempts: readonly SkillSignalAttempt[];
  history: SkillTeachingHistory;
  now: Date;
}): SkillMistakeSignal {
  const { helpedAt, replayedAt, secondTakeAt } = history;
  const recent = recentCounts({ attempts, helpedAt, now });
  const episode = activeEpisode(recent);
  const misses = episode.filter((attempt) => !attempt.isCorrect);
  const recentMisses = recent.filter((attempt) => !attempt.isCorrect);
  const [latest] = recentMisses;

  const latestMiss = latest
    ? {
        answeredAt: latest.answeredAt,
        id: latest.id,
        itemId: latest.itemId,
        mockExamId: latest.mockExamId,
        stepId: latest.stepId,
      }
    : null;

  const stuck =
    hasRepeatedMisses(misses) && recentMisses.length >= recent.length * REQUIRED_MISS_SHARE;

  return {
    ...history,
    dueSecondTake: Boolean(
      stuck &&
      !secondTakeAt &&
      replayedAt &&
      latestMiss &&
      latestMiss.answeredAt.getTime() >= replayedAt.getTime() + SECOND_TAKE_DELAY_DAYS * MS_PER_DAY,
    ),
    latestMiss,
    stage: getStage(history),
    stuck,
  };
}

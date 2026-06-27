import { parseLocalDate } from "@zoonk/utils/date";
import { type CompletionProgress, type PlayerProgressSnapshot } from "../completion-milestones";
import { type BestDayScore, getBestDayScore } from "./completion-milestone-thresholds";

export type ScoreCompletionMilestone = {
  dayOfWeek: number;
  kind: "score";
  score: number;
  status: "bestDay";
};

/**
 * Applies the just-finished lesson to the weekday totals before ranking them.
 * The milestone appears before persistence finishes, but the linked score page
 * will rank the saved totals, so the preview must include the current result.
 */
function getUpdatedBestDayScore({
  completion,
  score,
  todayDayOfWeek,
}: {
  completion: CompletionProgress;
  score: BestDayScore;
  todayDayOfWeek: number;
}): BestDayScore {
  if (score.dayOfWeek !== todayDayOfWeek) {
    return score;
  }

  return {
    ...score,
    correctAnswers: score.correctAnswers + (completion.correctCount ?? 0),
    incorrectAnswers: score.incorrectAnswers + (completion.incorrectCount ?? 0),
  };
}

/**
 * Ensures today's weekday exists in the score rows even when this is the first
 * interactive lesson on that weekday inside the rolling score window.
 */
function getTodayScore({
  completion,
  todayDayOfWeek,
}: {
  completion: CompletionProgress;
  todayDayOfWeek: number;
}): BestDayScore {
  return {
    correctAnswers: completion.correctCount ?? 0,
    dayOfWeek: todayDayOfWeek,
    incorrectAnswers: completion.incorrectCount ?? 0,
  };
}

/**
 * Builds the same weekday totals the score page will see after this completion
 * is saved, without mutating the server snapshot used by other milestones.
 */
function getPostCompletionBestDayScores({
  bestDayScores,
  completion,
  todayDayOfWeek,
}: {
  bestDayScores: BestDayScore[];
  completion: CompletionProgress;
  todayDayOfWeek: number;
}) {
  const hasTodayScore = bestDayScores.some((score) => score.dayOfWeek === todayDayOfWeek);

  if (!hasTodayScore) {
    return [...bestDayScores, getTodayScore({ completion, todayDayOfWeek })];
  }

  return bestDayScores.map((score) =>
    getUpdatedBestDayScore({ completion, score, todayDayOfWeek }),
  );
}

/**
 * Best-day milestones should appear once on the learner's strongest weekday.
 * Requiring zero prior interactive lessons today makes the once-per-day rule
 * durable after reloads, while session storage still protects prefetched pages.
 */
export function getBestDayMilestone({
  completion,
  localDate,
  progressSnapshot,
}: {
  completion: CompletionProgress;
  localDate: string;
  progressSnapshot: PlayerProgressSnapshot | null;
}): ScoreCompletionMilestone | null {
  const bestDayScores = progressSnapshot?.bestDayScores;

  if (
    !progressSnapshot ||
    !bestDayScores ||
    !completion.completedInteractiveLesson ||
    (progressSnapshot.todayInteractiveLessons ?? 0) > 0
  ) {
    return null;
  }

  const todayDayOfWeek = parseLocalDate(localDate).getUTCDay();

  const bestDay = getBestDayScore(
    getPostCompletionBestDayScores({ bestDayScores, completion, todayDayOfWeek }),
  );

  if (!bestDay || bestDay.key !== todayDayOfWeek) {
    return null;
  }

  return { dayOfWeek: todayDayOfWeek, kind: "score", score: bestDay.score, status: "bestDay" };
}

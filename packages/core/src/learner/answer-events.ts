import { type LearnerSkill, type Mistake } from "@zoonk/db";
import { type AnalyticsEvent } from "../analytics/events";
import { getLocalDaysBetween } from "./_utils/local-time";

export type SkillReview = { after: LearnerSkill; before: LearnerSkill };

type FixedMistake = Pick<Mistake, "cause" | "skillId">;

/** Same-local-day answers are learning rather than recall; days after due may be negative. */
function getReviewEvent({
  answeredAt,
  isCorrect,
  review,
  timeZone,
}: {
  answeredAt: Date;
  isCorrect: boolean;
  review: SkillReview;
  timeZone: string;
}): AnalyticsEvent[] {
  const { before } = review;

  if (before.reps === 0 || !before.lastReviewedAt) {
    return [];
  }

  const daysSinceLastReview = getLocalDaysBetween({
    from: before.lastReviewedAt,
    timeZone,
    to: answeredAt,
  });

  if (daysSinceLastReview <= 0) {
    return [];
  }

  return [
    {
      name: "Review Completed",
      properties: {
        days_after_due: before.due
          ? getLocalDaysBetween({ from: before.due, timeZone, to: answeredAt })
          : 0,
        days_since_last_review: daysSinceLastReview,
        is_correct: isCorrect,
        skill_id: before.skillId,
      },
    },
  ];
}

function getLevelEvent({ after, before }: SkillReview): AnalyticsEvent[] {
  if (after.state === before.state) {
    return [];
  }

  return [
    {
      name: "Skill Level Changed",
      properties: { from_state: before.state, skill_id: after.skillId, to_state: after.state },
    },
  ];
}

export function getAnswerEvents({
  answeredAt,
  fixedMistakes,
  isCorrect,
  review,
  timeZone,
}: {
  answeredAt: Date;
  fixedMistakes: readonly FixedMistake[];
  isCorrect: boolean;
  review: SkillReview | null;
  timeZone: string;
}): AnalyticsEvent[] {
  return [
    ...(review ? getReviewEvent({ answeredAt, isCorrect, review, timeZone }) : []),
    ...(review ? getLevelEvent(review) : []),
    ...fixedMistakes.map((mistake): AnalyticsEvent => ({
      name: "Mistake Fixed",
      properties: { cause: mistake.cause, skill_id: mistake.skillId },
    })),
  ];
}

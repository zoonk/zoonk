import { type LearnerSkill, type Mistake } from "@zoonk/db";
import { type AnalyticsEvent } from "../analytics/events";
import { getLocalDaysBetween } from "./_utils/local-time";

/** A skill's memory right before and right after one answer. */
export type SkillReview = { after: LearnerSkill; before: LearnerSkill };

type FixedMistake = Pick<Mistake, "cause" | "skillId">;

/**
 * "Review Completed" for the first answer on a later learner-local day of a skill already studied,
 * like the recall days mastery counts: answers on the day a skill is taught, or again the same day,
 * are learning, not recall. Days after due are negative for an early review.
 */
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

/**
 * The learning outcomes one recorded answer produced: a spaced review of its skill, the skill's
 * mastery state changing, and each notebook mistake it fixed.
 */
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

import "server-only";
import { getDaysToExam } from "../../exams/final-stretch/final-stretch-rules";
import { getPracticePicks } from "../../library/exams/practice-picks";
import { practicesShortAnswers } from "../../library/exams/short-answers";
import { type loadDayPlan } from "./day-plan";
import { type DayPracticeQuery } from "./day-work";
import { getReviewHorizon, type loadReviewCapsules } from "./load-review-capsules";
import { getPracticeDifficulty } from "./practice-difficulty";
import { getPracticeWeights } from "./review-skills";
import { type SessionDayContext } from "./session-placement";

export function toReviewInput({
  context: { goal, localDate, timeZone, userId },
  field,
  netScored,
  plan,
}: {
  context: Pick<SessionDayContext, "goal" | "localDate" | "timeZone" | "userId">;
  field: string | null;
  netScored: boolean;
  plan: Awaited<ReturnType<typeof loadDayPlan>>;
}): Parameters<typeof loadReviewCapsules>[0] {
  return {
    dailyMinutes: goal.dailyMinutes,
    examBlueprintId: goal.examBlueprintId,
    field,
    horizon: getReviewHorizon({
      finalStretchStart: plan.finalStretchStart,
      goal,
      localDate,
      timeZone,
    }),
    listeningSkillIds: plan.listeningSkillIds,
    netScoring: netScored,
    picks: getPracticePicks({ goal, structure: plan.structure }),
    planLessons: plan.items.flatMap((item) =>
      item.lessonId ? [{ ...item, lessonId: item.lessonId }] : [],
    ),
    skillIds: plan.skills.map((skill) => skill.id),
    userId,
  };
}

export function toDayPracticeQuery({
  claims,
  context: { goal, localDate, now, userId },
  field,
  fullReview,
  heldSkillIds,
  isReviewDay,
  lessonsLeft,
  plan,
  skillIds,
}: Pick<DayPracticeQuery, "claims" | "field" | "skillIds"> & {
  context: Pick<SessionDayContext, "goal" | "localDate" | "now" | "userId">;
  fullReview: boolean;
  heldSkillIds: DayPracticeQuery["firstSkillIds"];
  isReviewDay: boolean;
  lessonsLeft: boolean;
  plan: Awaited<ReturnType<typeof loadDayPlan>>;
}): DayPracticeQuery {
  return {
    claims,
    difficultyBias: getPracticeDifficulty({
      daysToExam: getDaysToExam({ targetDate: goal.targetDate, today: localDate }),
      hasLessonsLeft: lessonsLeft,
      settings: plan.settings,
    }),
    everySkill: fullReview,
    examBlueprintId: goal.examBlueprintId,
    field,
    firstSkillIds: heldSkillIds,
    ...getPracticeWeights({ ...plan, isReviewDay }),
    listeningSkillIds: plan.listeningSkillIds,
    maxMinutes: plan.dayMinutes,
    now,
    picks: getPracticePicks({ goal, structure: plan.structure }),
    repeatOnlyMissed: isReviewDay,
    skillIds,
    typed: practicesShortAnswers({ goal, structure: plan.structure }),
    userId,
  };
}

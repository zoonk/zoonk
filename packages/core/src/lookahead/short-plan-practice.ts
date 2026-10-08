import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { addDays, daysBetween, fromIsoDate, getPlanCalendar } from "../plans/planner/plan-calendar";
import { getExamDayRules, getPlannedMinutes } from "../plans/planner/plan-days";
import { parsePlanGraph, parsePlanSettings } from "../plans/planner/plan-state";
import { isShortExam } from "../plans/planner/short-exam-plan";
import { PRACTICE_MINUTES_PER_QUESTION } from "../sessions/session-builder";

/**
 * A short plan's skills get at least a few questions each, and no more than a handful: the
 * learner's material is short, and the day's mock and practice draw from the same questions.
 */
const MIN_QUESTIONS_PER_SKILL = 4;
const MAX_QUESTIONS_PER_SKILL = 8;

/**
 * A class test's few topics. A public exam days away has many more skills, and the Library's
 * questions and lessons for them: writing a bank for each would cost more than it adds. A test
 * from the learner's own material has a skill for each of its topics and nothing in the Library,
 * so it gets its bank however many it has.
 */
const MAX_SHORT_PLAN_SKILLS = 12;

/** The questions a short plan's practice draws from, per skill, and the skills that need them. */
export type ShortPlanPracticeNeed = { questionsPerSkill: number; skillIds: string[] };

/**
 * The practice a test days away needs written: a class test on Friday has two or three days, and
 * a learner who already knows its lessons (placement tested them out) spends them practicing,
 * then on the short mock, all from the same few questions. Placement writes one or two a skill,
 * so the plan's days would come up empty: this sizes the bank to the days' time, a question every
 * minute and a half, shared among the plan's skills. Null for any plan longer than a week, whose
 * lessons and the Library's questions fill its days, and for an exam with many subjects.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
export async function getShortPlanPracticeNeed(
  goalId: string,
): Promise<ShortPlanPracticeNeed | null> {
  const goal = await prisma.goal.findUnique({
    include: {
      examBlueprint: { select: { ownerId: true } },
      plan: { select: { graph: true, settings: true } },
    },
    where: { id: goalId },
  });

  if (!goal?.plan || goal.kind !== "exam" || !goal.targetDate) {
    return null;
  }

  const settings = parsePlanSettings(goal.plan.settings);
  const skillIds = parsePlanGraph(goal.plan.graph).skills.map((skill) => skill.skillId);
  const today = getDateInTimeZone({ date: new Date(), timeZone: getAnswerTimeZone({ goal }) });
  const planStart = settings.startDate ? fromIsoDate(settings.startDate) : today;
  const { targetDate } = goal;

  const isOwnMaterial = Boolean(goal.examBlueprint?.ownerId);

  if (
    skillIds.length === 0 ||
    (!isOwnMaterial && skillIds.length > MAX_SHORT_PLAN_SKILLS) ||
    !isShortExam({ planStart, targetDate })
  ) {
    return null;
  }

  const calendar = getPlanCalendar({ dailyMinutes: goal.dailyMinutes, settings });
  const exam = getExamDayRules({ isExam: true, settings });

  const minutes = Array.from({ length: daysBetween(planStart, targetDate) }, (_, offset) =>
    getPlannedMinutes({ calendar, date: addDays(planStart, offset), exam, targetDate }),
  ).reduce((total, day) => total + day, 0);

  const questions = Math.floor(minutes / PRACTICE_MINUTES_PER_QUESTION);

  return {
    questionsPerSkill: Math.min(
      MAX_QUESTIONS_PER_SKILL,
      Math.max(MIN_QUESTIONS_PER_SKILL, Math.ceil(questions / skillIds.length)),
    ),
    skillIds,
  };
}

import "server-only";
import { prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { toListeningExam } from "../exams/listening/listening-exam";
import { getListeningSkillIds } from "../exams/listening/listening-skills";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { addDays, daysBetween, fromIsoDate, getPlanCalendar } from "../plans/planner/plan-calendar";
import { getExamDayRules, getPlannedMinutes } from "../plans/planner/plan-days";
import { parsePlanGraph, parsePlanSettings } from "../plans/planner/plan-state";
import { isShortExam } from "../plans/planner/short-exam-plan";
import { PRACTICE_MINUTES_PER_QUESTION } from "../sessions/session-builder";

const MIN_QUESTIONS_PER_SKILL = 4;
const MAX_QUESTIONS_PER_SKILL = 8;

/** Own-material tests need a question bank even above the public-exam skill cap, since the Library has no reusable questions. */
const MAX_SHORT_PLAN_SKILLS = 12;

export type ShortPlanPracticeNeed = { questionsPerSkill: number; skillIds: string[] };

/** Workflow bridge: authorize goalId first; null for plans longer than a week or broad public exams. */
export async function getShortPlanPracticeNeed(
  goalId: string,
): Promise<ShortPlanPracticeNeed | null> {
  const goal = await prisma.goal.findUnique({
    include: { examBlueprint: true, plan: { select: { graph: true, settings: true } } },
    where: { id: goalId },
  });

  if (!goal?.plan || goal.kind !== "exam" || !goal.targetDate) {
    return null;
  }

  const settings = parsePlanSettings(goal.plan.settings);
  const graph = parsePlanGraph(goal.plan.graph);

  const listening = getListeningSkillIds({ exam: toListeningExam(goal), graph });

  const skillIds = graph.skills
    .map((skill) => skill.skillId)
    .filter((skillId) => !listening.has(skillId));

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

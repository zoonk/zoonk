import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { getDayBeforePlan, loadShortPlanDay } from "../../plans/_utils/load-short-plan-day";
import { loadPreparationInputs } from "../../preparation/_utils/load-preparation-inputs";
import { resolveViewGoal } from "../../view-models/_utils/resolve-view-goal";
import { getExamCalendar, toExamDates } from "../_utils/exam-calendar";
import { loadGoalScoreEstimate } from "../estimates/load-goal-estimate";
import {
  getDaysToExam,
  getExamDayChecklist,
  getExamStage,
} from "../final-stretch/final-stretch-rules";
import { loadFinalStretchStart } from "../final-stretch/load-final-stretch-start";
import { getSpeakingMockExam } from "../language-exam";
import { type ExamMap, buildExamMap } from "../map/exam-map";
import { loadSkillAreas } from "../mocks/_utils/mock-candidates";
import { getMockScoring } from "../mocks/_utils/plan-weekly-mock";
import { toExamResultView } from "../results/exam-result-contract";
import { getExamScale } from "../scoring/exam-scales";
import { loadExamHistory } from "./_utils/exam-history";
import { type ExamView } from "./exam-view-contract";

export type ExamViewResult =
  | { exam: ExamView; status: "ready" }
  | { status: "noGoal" | "notExam" | "notFound" | "unauthorized" };

async function loadMap({
  blueprint,
  goalId,
  userId,
}: {
  blueprint: ExamBlueprint | null;
  goalId: string;
  userId: string;
}): Promise<ExamMap | null> {
  if (!blueprint) {
    return null;
  }

  const content = readBlueprintContent(blueprint);
  const areas = await loadSkillAreas(goalId);

  const learnerSkills = await prisma.learnerSkill.findMany({
    select: { skillId: true, state: true },
    where: { skillId: { in: [...areas.keys()] }, userId },
  });

  const states = new Map(learnerSkills.map((row) => [row.skillId, row.state]));

  return buildExamMap({
    frequency: content.topicFrequency,
    skills: [...areas].map(([skillId, area]) => ({ area, state: states.get(skillId) ?? "new" })),
    structure: content.structure,
  });
}

/**
 * The learner's exam screen for one exam goal (the active goal by default): its days and where
 * the learner stands against them, the exam map with their level per subject, how it's scored and
 * the strategy that follows, the mocks so far, the estimated score after a mock, and the official
 * result once reported.
 */
export async function getExamView({
  goalId: requestedGoalId,
  timeZone: requestTimeZone,
}: {
  goalId?: string;
  timeZone?: string;
}): Promise<ExamViewResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(requestedGoalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;
  const { id: goalId, userId } = goal;

  if (goal.kind !== "exam") {
    return { status: "notExam" };
  }

  const blueprint = goal.examBlueprintId
    ? await prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
    : null;

  const calendar = getExamCalendar({ blueprint, goal });
  const timeZone = getAnswerTimeZone({ goal, timeZone: requestTimeZone });
  const today = getDateInTimeZone({ date: new Date(), timeZone });
  const structure = blueprint ? readBlueprintContent(blueprint).structure : null;
  const scale = getExamScale({ blueprint, goal });
  const inputs = await loadPreparationInputs({ goalId, now: new Date(), userId });

  const [map, history, estimate, result, shortPlan, finalStretchStart] = await Promise.all([
    loadMap({ blueprint, goalId, userId }),
    loadExamHistory(goalId),
    loadGoalScoreEstimate({ goal, ledgerMocks: inputs.mocks }),
    prisma.examResult.findUnique({ where: { goalId } }),
    loadShortPlanDay({ goal, today }),
    loadFinalStretchStart(goalId),
  ]);

  return {
    exam: {
      calibration: history.calibration,
      checklist: getExamDayChecklist(blueprint),
      dayBefore: getDayBeforePlan({ shortPlan, today }),
      days: calendar.days,
      daysEstimated: calendar.estimated,
      daysLeft: getDaysToExam({ targetDate: toExamDates(calendar)[0] ?? null, today }),
      estimate,
      examName: blueprint?.name ?? goal.title,
      goalId,
      map,
      mocks: history.mocks,
      result: result ? toExamResultView(result) : null,
      scoring: {
        method: getMockScoring({ scale, structure }),
        note: structure?.mock?.scoring.description ?? null,
        scale,
      },
      sessionsDone: history.sessionsDone,
      speakingMock: getSpeakingMockExam(goal),
      stage: getExamStage({ examDays: toExamDates(calendar), finalStretchStart, today }),
      timeZone: calendar.timeZone,
    },
    status: "ready",
  };
}

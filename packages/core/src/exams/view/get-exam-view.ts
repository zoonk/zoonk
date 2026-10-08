import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAllowance } from "../../entitlements/get-allowance";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getPassMarks } from "../../library/exams/pass-marks";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { getDayBeforePlan, loadShortPlanDay } from "../../plans/_utils/load-short-plan-day";
import { loadPreparationInputs } from "../../preparation/_utils/load-preparation-inputs";
import { getExamPrepAccess } from "../../sessions/_utils/exam-access";
import { resolveViewGoal } from "../../view-models/_utils/resolve-view-goal";
import { getExamCalendar, toExamDates } from "../_utils/exam-calendar";
import { loadTargetCutoff } from "../cutoffs/load-target-cutoff";
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
import { getExamFormat } from "./_utils/exam-format";
import { loadExamHistory } from "./_utils/exam-history";
import { loadNextMock } from "./_utils/next-mock";
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

/** The score the learner said they aim for, in their words. */
function readTargetScore(details: unknown): string | null {
  const target = isJsonObject(details) ? details.targetScore : null;

  if (typeof target === "number") {
    return String(target);
  }

  return typeof target === "string" && target.trim() ? target.trim() : null;
}

/** The scoring methods a notice states that change how to answer. */
const STATED_SCORINGS: ReadonlySet<string> = new Set([
  "itemResponseTheory",
  "raw",
  "wrongCancelsRight",
]);

/**
 * Whether the notice itself says how the exam is scored: its reading found the mock conditions and
 * a scoring method. A class test read from the learner's material rarely says, and the mocks'
 * default (each answer a point) is no rule to give advice from.
 */
function isScoringStated(structure: ExamStructure | null): boolean {
  const method = structure?.mock?.scoring.method;
  return method !== undefined && STATED_SCORINGS.has(method);
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

  const [inputs, allowance] = await Promise.all([
    loadPreparationInputs({ goalId, now: new Date(), userId }),
    getAllowance(),
  ]);

  // The plan's weekly mocks come with Plus: without it, the page shows them locked.
  const { includesMockExams } = getExamPrepAccess({
    examPrep: allowance?.examPrep ?? null,
    goal,
    timeZone,
    today,
  });

  const [map, history, estimate, result, shortPlan, finalStretchStart, nextMock, cutoff] =
    await Promise.all([
      loadMap({ blueprint, goalId, userId }),
      loadExamHistory({ goalId, today }),
      loadGoalScoreEstimate({ goal, ledgerMocks: inputs.mockResults }),
      prisma.examResult.findUnique({ where: { goalId } }),
      loadShortPlanDay({ goal, today }),
      loadFinalStretchStart(goalId),
      loadNextMock({ blueprint, goal, today }),
      loadTargetCutoff({ details: goal.details, examBlueprintId: goal.examBlueprintId }),
    ]);

  return {
    exam: {
      calibration: history.calibration,
      checklist: getExamDayChecklist(blueprint),
      cutoff,
      dayBefore: getDayBeforePlan({ includesMockExams, shortPlan, today }),
      days: calendar.days,
      daysEstimated: calendar.estimated,
      daysLeft: getDaysToExam({ targetDate: toExamDates(calendar)[0] ?? null, today }),
      estimate,
      examName: blueprint?.name ?? goal.title,
      format: getExamFormat({ days: calendar.days, structure }),
      goalId,
      map,
      mocks: history.mocks,
      mocksRequirePlus: !includesMockExams,
      nextMock,
      passMarks: structure ? getPassMarks(structure) : [],
      prepared: history.prepared,
      result: result ? toExamResultView(result) : null,
      scoring: {
        method: getMockScoring({ scale, structure }),
        note: structure?.mock?.scoring.description ?? null,
        scale,
        stated: isScoringStated(structure),
      },
      sessionsDone: history.sessionsDone,
      speakingMock: getSpeakingMockExam(goal),
      stage: getExamStage({ examDays: toExamDates(calendar), finalStretchStart, today }),
      targetScore: readTargetScore(goal.details),
      timeZone: calendar.timeZone,
    },
    status: "ready",
  };
}

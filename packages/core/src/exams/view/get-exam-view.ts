import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { getBaseLanguage } from "@zoonk/utils/languages";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import { getAllowance } from "../../entitlements/get-allowance";
import { readLiveCallAdmission } from "../../language/conversations/_utils/live-call-policy";
import { loadSpeakingPaper } from "../../language/exam-speaking/_utils/exam-speaking-setup";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { readExamBlueprint } from "../../learner/facts/exam-blueprint";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { type PassMarks, getPassMarks } from "../../library/exams/pass-marks";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { getDayBeforePlan, loadShortPlanDay } from "../../plans/_utils/load-short-plan-day";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { parsePlanSettings } from "../../plans/planner/plan-state";
import { loadPreparationInputs } from "../../preparation/_utils/load-preparation-inputs";
import { getExamPrepAccess } from "../../sessions/_utils/exam-access";
import { resolveViewGoal } from "../../view-models/_utils/resolve-view-goal";
import { getExamCalendar, toExamDates } from "../_utils/exam-calendar";
import { type NoticeDates, loadNoticeDates } from "../_utils/notice-day";
import { toChosenStructure } from "../choices/exam-choices";
import { loadExamChoices } from "../choices/load-exam-choices";
import { loadTargetCutoff } from "../cutoffs/load-target-cutoff";
import { loadGoalScoreEstimate } from "../estimates/load-goal-estimate";
import { getExamDocument } from "../exam-document";
import {
  getDaysToExam,
  getExamDayChecklist,
  getExamStage,
} from "../final-stretch/final-stretch-rules";
import { loadFinalStretchStart } from "../final-stretch/load-final-stretch-start";
import { getSpeakingMockExam } from "../language-exam";
import { type ExamMap, buildExamMap } from "../map/exam-map";
import { loadSkillAreas } from "../mocks/_utils/mock-candidates";
import { toExamResultView } from "../results/exam-result-contract";
import { getExamScale } from "../scoring/exam-scales";
import { getMockScoring, getWrongPenalty } from "../scoring/mock-scoring";
import { getExamFormat } from "./_utils/exam-format";
import { loadExamHistory } from "./_utils/exam-history";
import { listExamTools } from "./_utils/exam-tools";
import { loadNextMock } from "./_utils/next-mock";
import { loadRunningMocks, pickExamMocks } from "./_utils/running-mock";
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
  const [areas, choices] = await Promise.all([loadSkillAreas(goalId), loadExamChoices(goalId)]);

  const learnerSkills = await prisma.learnerSkill.findMany({
    select: { skillId: true, state: true },
    where: { skillId: { in: [...areas.keys()] }, userId },
  });

  const states = new Map(learnerSkills.map((row) => [row.skillId, row.state]));

  return buildExamMap({
    frequency: content.topicFrequency,
    skills: [...areas].map(([skillId, area]) => ({ area, state: states.get(skillId) ?? "new" })),
    // The exam as the learner takes it: only the options of its choices they picked.
    structure: toChosenStructure({ choices, structure: content.structure }),
  });
}

/**
 * The notice's exam day when the plan counts down to another, read against the day the plan took
 * from the notice, so the page offers it as Today does, or that the learner's month has no sitting.
 */
async function loadExamNoticeDates({
  blueprint,
  goal,
  today,
}: {
  blueprint: ExamBlueprint | null;
  goal: Pick<Goal, "details" | "examBlueprintId" | "id" | "kind" | "targetDate">;
  today: Date;
}): Promise<NoticeDates> {
  const plan = await prisma.plan.findUnique({
    select: { settings: true },
    where: { goalId: goal.id },
  });

  return loadNoticeDates({
    blueprint,
    goal,
    goalDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
    noticeDate: plan ? parsePlanSettings(plan.settings).noticeDate : null,
    today: toIsoDate(today),
  });
}

/**
 * What it takes to pass, as the notice says it (see `getPassMarks`). When it's in another language
 * than the learner's (a notice read before translations) and the notice's scale states the passing
 * score, the scale's row says it in theirs, so the notice's own words are left out.
 */
function getExamPassMarks({
  blueprint,
  goal,
  structure,
}: {
  blueprint: ExamBlueprint | null;
  goal: Pick<Goal, "language">;
  structure: ExamStructure | null;
}): PassMarks | null {
  if (!blueprint || !structure) {
    return null;
  }

  const passMarks = getPassMarks({ blueprint, goal, structure });

  const isForeign = passMarks && passMarks.language !== getBaseLanguage(goal.language);
  const scaled = structure.mock?.scoring.scale?.passScore;

  return isForeign && typeof scaled === "number" ? null : passMarks;
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

/** The notice's scoring rule that changes how to answer (see `ExamView["scoring"]["rule"]`). */
function getScoringRule(structure: ExamStructure | null): ExamView["scoring"]["rule"] {
  if (!isScoringStated(structure)) {
    return null;
  }

  const method = structure?.mock?.scoring.method;

  if (method === "itemResponseTheory") {
    return "irt";
  }

  return getWrongPenalty(structure) > 0 ? "net" : "raw";
}

/** The scale the notice says the exam reports on, for the page's scoring section. */
function toNoticeScale(structure: ExamStructure | null): ExamView["scoring"]["noticeScale"] {
  const scale = structure?.mock?.scoring.scale;

  return scale
    ? { max: scale.max, min: scale.min, name: scale.name, passScore: scale.passScore }
    : null;
}

/**
 * The learner's exam screen for one exam goal (the active goal by default): its days (with the
 * notice's day when the plan counts down to another) and where the learner stands against them,
 * the exam map with their level per subject, how it's scored and the strategy that follows, the
 * mocks running and the ones so far, the estimated score after a mock, and the official result
 * once reported.
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

  const blueprint = goal.examBlueprintId ? await readExamBlueprint(goal.examBlueprintId) : null;

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

  const [
    map,
    history,
    estimate,
    result,
    shortPlan,
    finalStretchStart,
    nextMock,
    running,
    cutoff,
    noticeDates,
    speaking,
    admission,
  ] = await Promise.all([
    loadMap({ blueprint, goalId, userId }),
    loadExamHistory({ goalId, today }),
    loadGoalScoreEstimate({ blueprint, goal, ledgerMocks: inputs.mockResults }),
    prisma.examResult.findUnique({ where: { goalId } }),
    loadShortPlanDay({ goal, today }),
    loadFinalStretchStart(goalId),
    loadNextMock({ blueprint, goal, today }),
    loadRunningMocks({ goalId, userId }),
    loadTargetCutoff({ blueprint, details: goal.details, examBlueprintId: goal.examBlueprintId }),
    loadExamNoticeDates({ blueprint, goal, today }),
    loadSpeakingPaper({
      access: includesMockExams ? "open" : "plusRequired",
      goal: { ...goal, examBlueprint: blueprint },
    }),
    readLiveCallAdmission({ transaction: prisma, userId }),
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
      examDocument: getExamDocument(goal),
      examName: blueprint?.name ?? goal.title,
      // The month the learner named gives no sitting a day yet.
      format: getExamFormat({ days: calendar.namedMonth ? [] : calendar.days, structure }),
      goalId,
      map,
      mocks: history.mocks,
      mocksRequirePlus: !includesMockExams,
      namedMonth: calendar.namedMonth,
      ...pickExamMocks({ next: nextMock, running }),
      noSitting: noticeDates.noSitting,
      noticeDay: noticeDates.day,
      passMarks: getExamPassMarks({ blueprint, goal, structure }),
      prepared: history.prepared,
      // How mocks went over time comes with Plus, like the mocks: the page shows it locked.
      progress: includesMockExams ? history.progress : null,
      result: result ? toExamResultView(result) : null,
      scoring: {
        method: getMockScoring({ blueprint, goal, structure }),
        note: structure?.mock?.scoring.description ?? null,
        noticeScale: toNoticeScale(structure),
        rule: getScoringRule(structure),
        scale,
        stated: isScoringStated(structure),
        wrongPenalty: getWrongPenalty(structure),
      },
      sessionsDone: history.sessionsDone,
      speaking,
      speakingMock: getSpeakingMockExam(goal),
      speakingMockPaused: getSpeakingMockExam(goal) !== null && admission === null,
      stage: getExamStage({ examDays: toExamDates(calendar), finalStretchStart, today }),
      targetScore: readTargetScore(goal.details),
      timeZone: calendar.timeZone,
      tools: listExamTools(structure),
    },
    status: "ready",
  };
}

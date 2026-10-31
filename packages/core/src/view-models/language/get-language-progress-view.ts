import "server-only";
import { prisma } from "@zoonk/db";
import { getAllowance } from "../../entitlements/get-allowance";
import { getSpeakingMockExam } from "../../exams/language-exam";
import { readGoalDetails } from "../../language/_utils/language-goal";
import { readLiveCallAdmission } from "../../language/conversations/_utils/live-call-policy";
import { loadSpeakingPaper } from "../../language/exam-speaking/_utils/exam-speaking-setup";
import {
  getTargetLevel,
  loadLanguageSkillLevels,
} from "../../language/levels/language-skill-levels";
import { getOverallLevel } from "../../language/levels/skill-level-rules";
import { loadDoneUnitIds } from "../../language/units/can-do-events";
import { type LanguageUnit, findCurrentUnit } from "../../language/units/language-units";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { loadLanguageGoalContext } from "./_utils/language-goal-context";
import { type LanguageProgressView } from "./language-view-contract";

const DONE_UNITS_SHOWN = 2;

export type LanguageProgressViewResult =
  | { progress: LanguageProgressView; status: "ready" }
  | { status: "noGoal" | "notFound" | "notLanguage" | "unauthorized" };

type UnitProgress = { doneIds: ReadonlySet<string>; units: readonly LanguageUnit[] };

function getCanDo({ doneIds, units }: UnitProgress) {
  const current = findCurrentUnit({ doneIds, units });
  const ahead = current && !doneIds.has(current.chapterId) ? current : null;
  const done = units.filter((unit) => doneIds.has(unit.chapterId)).slice(-DONE_UNITS_SHOWN);

  return [
    ...done.flatMap((unit) =>
      unit.objectives.map((text) => ({ done: true, text, unitTitle: unit.title })),
    ),
    ...(ahead?.objectives.map((text) => ({ done: false, text, unitTitle: ahead.title })) ?? []),
  ];
}

/** Requires an owned language goal, defaulting to the active goal. */
export async function getLanguageProgressView(
  input: { goalId?: string } = {},
): Promise<LanguageProgressViewResult> {
  "use cache: private";

  const loaded = await loadLanguageGoalContext(input.goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  const { goal, units, userId } = loaded.context;
  const details = readGoalDetails(goal);

  const [levels, doneIds, allowance, admission] = await Promise.all([
    loadLanguageSkillLevels({ details, language: goal.targetLanguage, userId }),
    loadDoneUnitIds({ units, userId }),
    getAllowance(),
    readLiveCallAdmission({ transaction: prisma, userId }),
  ]);

  // An exam's speaking tasks come with Plus, like its mocks: free learners see them locked.
  const speaking = await loadSpeakingPaper({
    access: allowance?.examPrep.includesMockExams ? "open" : "plusRequired",
    goal,
  });

  return {
    progress: {
      canDo: getCanDo({ doneIds, units }),
      goal: {
        id: goal.id,
        targetDate: goal.targetDate ? toIsoDate(goal.targetDate) : null,
        targetLanguage: goal.targetLanguage,
        title: goal.title,
      },
      level: getOverallLevel(levels.map((level) => level.score)),
      levels,
      speaking,
      speakingMock: getSpeakingMockExam(goal),
      speakingMockPaused: getSpeakingMockExam(goal) !== null && admission === null,
      target: getTargetLevel(details),
    },
    status: "ready",
  };
}

import "server-only";
import { getAllowance } from "../../entitlements/get-allowance";
import { getSpeakingMockExam } from "../../exams/language-exam";
import { readGoalDetails } from "../../language/_utils/language-goal";
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

/** Finished units shown in "I can already", newest last, beside the current unit's checks. */
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

/**
 * Progress for a language goal: the level across skills and of each skill with how it moved since
 * the level test, the target, "I can already" checks from the units, and the exam's speaking mock
 * or speaking paper when it has one.
 */
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

  const [levels, doneIds, allowance] = await Promise.all([
    loadLanguageSkillLevels({ details, language: goal.targetLanguage, userId }),
    loadDoneUnitIds({ units, userId }),
    getAllowance(),
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
      target: getTargetLevel(details),
    },
    status: "ready",
  };
}

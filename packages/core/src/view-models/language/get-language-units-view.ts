import "server-only";
import { loadDoneUnitIds } from "../../language/units/can-do-events";
import { loadAlphabetIntro } from "../../library/language/alphabet/alphabet-intro";
import { loadLanguageGoalContext } from "./_utils/language-goal-context";
import { type LanguageUnitsView } from "./language-view-contract";

export type LanguageUnitsViewResult =
  | { status: "noGoal" | "notFound" | "notLanguage" | "unauthorized" }
  | { status: "ready"; units: LanguageUnitsView };

/** Requires an owned language goal; units follow teaching order and non-Latin alphabet practice comes first. */
export async function getLanguageUnitsView(
  input: { goalId?: string } = {},
): Promise<LanguageUnitsViewResult> {
  "use cache: private";

  const loaded = await loadLanguageGoalContext(input.goalId);

  if (loaded.status !== "ready") {
    return loaded;
  }

  const { goal, units, userId } = loaded.context;

  const [doneIds, alphabet] = await Promise.all([
    loadDoneUnitIds({ units, userId }),
    loadAlphabetIntro({ goal, userId }),
  ]);

  return {
    status: "ready",
    units: {
      alphabet,
      goalId: goal.id,
      units: units.map((unit) => ({
        chapterId: unit.chapterId,
        done: doneIds.has(unit.chapterId),
        lessonsDone: unit.lessons.filter((lesson) => lesson.done).length,
        lessonsTotal: unit.lessons.length,
        position: unit.position,
        title: unit.title,
      })),
    },
  };
}

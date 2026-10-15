import "server-only";
import {
  type QuickLessonRef,
  ensureQuickLessons,
  findQuickLessons,
} from "../../library/quick-lessons/quick-lessons";
import { type PlanSettings } from "../planner/plan-state";
import { type PlannerLesson } from "../planner/plan-units";

/** The bases the learner studies with a quick lesson (see `BaseChoice`). */
function listQuickBases(settings: Pick<PlanSettings, "baseChoices">): string[] {
  return settings.baseChoices.flatMap((entry) => (entry.choice === "quick" ? [entry.skillId] : []));
}

/** Whether the plan studies any of its bases with a quick lesson. */
export function hasQuickBases(settings: Pick<PlanSettings, "baseChoices">): boolean {
  return listQuickBases(settings).length > 0;
}

function toPlannerLesson([skillId, ref]: [string, QuickLessonRef]): [string, PlannerLesson] {
  return [
    skillId,
    {
      chapterId: null,
      lessonId: ref.lessonId,
      minutes: ref.estimatedMinutes,
      skillIds: [skillId],
      title: ref.title,
    },
  ];
}

/**
 * The quick lessons of the bases a plan studies with one, as the planner places them, creating
 * none (see `findQuickLessons`): a base whose quick lesson the Library doesn't have (not created
 * yet, as in a preview, or set aside after its last held-back draft) plans a stand-in of one.
 */
export async function loadQuickBaseLessons(
  settings: Pick<PlanSettings, "baseChoices">,
): Promise<Map<string, PlannerLesson>> {
  const skillIds = listQuickBases(settings);

  if (skillIds.length === 0) {
    return new Map();
  }

  const refs = await findQuickLessons({ skillIds });

  return new Map(
    [...refs].toSorted(([a], [b]) => a.localeCompare(b)).map((entry) => toPlannerLesson(entry)),
  );
}

/**
 * Creates the quick lessons the plan's bases are studied with (outlines only, no model call), so
 * the plan places them and the lesson pipeline writes them when the learner gets there. Called
 * from the request that chooses them, before planning.
 */
export async function ensureQuickBaseLessons(
  settings: Pick<PlanSettings, "baseChoices">,
): Promise<void> {
  const skillIds = listQuickBases(settings);

  if (skillIds.length > 0) {
    await ensureQuickLessons({ skillIds });
  }
}

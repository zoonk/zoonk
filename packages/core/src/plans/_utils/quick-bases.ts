import "server-only";
import {
  type QuickLessonRef,
  ensureQuickLessons,
  findQuickLessons,
} from "../../library/quick-lessons/quick-lessons";
import { type PlanSettings } from "../planner/plan-state";
import { type PlannerLesson } from "../planner/plan-units";

function listQuickBases(settings: Pick<PlanSettings, "baseChoices">): string[] {
  return settings.baseChoices.flatMap((entry) => (entry.choice === "quick" ? [entry.skillId] : []));
}

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

/** Outlines only, no model call. Call it before planning, from the request that chooses them. */
export async function ensureQuickBaseLessons(
  settings: Pick<PlanSettings, "baseChoices">,
): Promise<void> {
  const skillIds = listQuickBases(settings);

  if (skillIds.length > 0) {
    await ensureQuickLessons({ skillIds });
  }
}

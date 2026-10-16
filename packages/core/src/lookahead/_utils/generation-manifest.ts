import "server-only";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { loadGoalPlannerLessons } from "../../plans/_utils/planner-lessons";
import { PlanConflictError } from "../../plans/plan-conflict";
import { parsePlanGraph } from "../../plans/planner/plan-state";
import { getSettledSkillIds } from "../../plans/planner/settled-skills";
import { getSkippedSkillIds } from "../../sessions/_utils/review-skills";
import { isPlacementAhead } from "../../view-models/onboarding/onboarding-steps";

type GenerationTarget = { contentVersion: string; lessonId: string; sourceItemIds: string[] };

/** A bounded durable step result, passed by value to the children it admits. */
export type PlanGenerationManifest = {
  basis: {
    goalUpdatedAt: string;
    inputVersion: number;
    inputsKey: string | null;
    planId: string;
    planVersion: number;
  };
  goalId: string;
  targets: GenerationTarget[];
};

/**
 * Reads the saved selection, replacing only its still-todo stand-ins with the Library lessons
 * they now name. The canonical lesson resolver keeps course/tool/visibility rules in one place.
 * No new selection or calendar is computed, including while an outline's plan save is waiting.
 */
export async function readGenerationManifest({
  goalId,
  lessonIds,
}: {
  goalId: string;
  lessonIds: readonly string[];
}): Promise<PlanGenerationManifest | null> {
  const token = await prisma.plan.findUnique({ where: { goalId } });
  const goal = token ? await prisma.goal.findUnique({ where: { id: goalId } }) : null;

  if (!token || !goal || goal.status !== "active") {
    return null;
  }

  const graph = parsePlanGraph(token.graph);

  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: { kind: "lesson", planId: token.id },
  });

  const standIns = items.filter((item) => item.lessonId === null && item.status === "todo");

  const outlined =
    standIns.length > 0 ? await loadGoalPlannerLessons({ goal, graph, userId: goal.userId }) : [];

  const settled = getSettledSkillIds({ items, lessons: outlined });
  const skipped = getSkippedSkillIds({ graph, settings: token.settings });
  const placementAhead = isPlacementAhead(isJsonObject(goal.details) ? goal.details : {});

  const lessons = await prisma.lesson.findMany({
    select: { id: true, updatedAt: true, visibility: true },
    where: { ...libraryRowsVisibleTo(goal.userId), id: { in: [...lessonIds] }, setAsideAt: null },
  });

  const targets = lessons.flatMap((lesson) => {
    if (placementAhead && lesson.visibility === "private") {
      return [];
    }

    const taught = outlined.find((candidate) => candidate.lessonId === lesson.id);

    const sourceItemIds = items.flatMap((item) => {
      if (item.status !== "todo") {
        return [];
      }

      if (item.lessonId === lesson.id) {
        return [item.id];
      }

      return item.lessonId === null &&
        item.skillId !== null &&
        !settled.has(item.skillId) &&
        !skipped.has(item.skillId) &&
        taught?.skillIds.includes(item.skillId)
        ? [item.id]
        : [];
    });

    return sourceItemIds.length > 0
      ? [{ contentVersion: lesson.updatedAt.toISOString(), lessonId: lesson.id, sourceItemIds }]
      : [];
  });

  const current = await prisma.plan.findUnique({
    select: { inputVersion: true, version: true },
    where: { id: token.id },
  });

  if (current?.inputVersion !== token.inputVersion || current.version !== token.version) {
    throw new PlanConflictError();
  }

  const byId = new Map(targets.map((target) => [target.lessonId, target]));

  return {
    basis: {
      goalUpdatedAt: goal.updatedAt.toISOString(),
      inputVersion: token.inputVersion,
      inputsKey: token.inputsKey,
      planId: token.id,
      planVersion: token.version,
    },
    goalId,
    targets: lessonIds.flatMap((lessonId) => byId.get(lessonId) ?? []),
  };
}

/** A single statement verifies a queued batch's membership, content, placement and input epoch. */
export async function readCurrentGenerationTargets({
  lessonIds,
  manifest,
}: {
  lessonIds: readonly string[];
  manifest: PlanGenerationManifest;
}): Promise<string[]> {
  const targets = manifest.targets.filter((target) => lessonIds.includes(target.lessonId));

  if (targets.length === 0) {
    return [];
  }

  const { basis } = manifest;

  const rows = await prisma.$queryRaw<{ lessonId: string }[]>`
    SELECT t.value->>'lessonId' AS "lessonId"
    FROM plans p
    JOIN goals g ON g.id = p.goal_id
    CROSS JOIN jsonb_array_elements(${JSON.stringify(targets)}::jsonb) t(value)
    JOIN library_lessons l ON l.id = (t.value->>'lessonId')::uuid
    WHERE p.id = ${basis.planId}::uuid AND p.goal_id = ${manifest.goalId}::uuid
      AND p.version = ${basis.planVersion} AND p.input_version = ${basis.inputVersion}
      AND p.inputs_key IS NOT DISTINCT FROM ${basis.inputsKey}
      AND date_trunc('milliseconds', g.updated_at) = ${basis.goalUpdatedAt}::timestamp
      AND g.status = 'active' AND l.set_aside_at IS NULL
      AND (l.visibility = 'public' OR l.owner_id = g.user_id)
      AND date_trunc('milliseconds', l.updated_at) = (t.value->>'contentVersion')::timestamp
      AND EXISTS (
        SELECT 1 FROM plan_items i
        WHERE i.plan_id = p.id AND i.status = 'todo' AND i.kind = 'lesson'
          AND i.id::text IN (SELECT jsonb_array_elements_text(t.value->'sourceItemIds'))
      )
  `;

  const current = new Set(rows.map((row) => row.lessonId));
  return lessonIds.filter((lessonId) => current.has(lessonId));
}

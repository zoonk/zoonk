import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { loadGoalPlan } from "../../learner/_utils/goal-skill-graph";
import { toSkillStatus } from "../../learner/_utils/skill-status";
import { parsePlanPhases } from "../../plans/planner/plan-state";
import { type MapArea, type MapPhase } from "../map/map-contract";
import { type MapItem, type MapNode, buildGoalMapAreas } from "./goal-map-areas";

/** The goal's skills as the maps draw them, grouped by chapter and phase, in plan order. */
export type GoalMap = {
  areas: MapArea[];
  /** Every course the plan's chapters sit in, the one each chapter shows under first. */
  courseIds: string[];
  /** The plan's items with the skills each teaches, for chapter pages. */
  items: MapItem[];
  phases: MapPhase[];
};

/**
 * A chapter's course on the map: the goal's main course when the chapter is in it, otherwise the
 * chapter's home course, otherwise any course it sits in.
 */
function pickCourseId({
  chapter,
  primaryCourseId,
}: {
  chapter: { courses: { courseId: string }[]; homeCourseId: string | null };
  primaryCourseId: string | null;
}) {
  const courseIds = chapter.courses.map((placement) => placement.courseId);

  if (primaryCourseId && courseIds.includes(primaryCourseId)) {
    return primaryCourseId;
  }

  return chapter.homeCourseId ?? courseIds[0] ?? null;
}

async function loadPlanRows(goalId: string) {
  const plan = await prisma.plan.findUnique({
    select: {
      items: {
        orderBy: { position: "asc" },
        select: {
          chapterId: true,
          id: true,
          kind: true,
          lessonId: true,
          phase: true,
          status: true,
        },
      },
      phases: true,
    },
    where: { goalId },
  });

  return {
    items: plan?.items ?? [],
    phaseNames: parsePlanPhases(plan?.phases).map((phase) => phase.name),
  };
}

async function loadAreaDetails({
  chapterIds,
  primaryCourseId,
}: {
  chapterIds: string[];
  primaryCourseId: string | null;
}) {
  const chapters = await prisma.chapter.findMany({
    select: { courses: { select: { courseId: true } }, homeCourseId: true, id: true, title: true },
    where: { id: { in: chapterIds } },
  });

  return new Map(
    chapters.map((chapter) => [
      chapter.id,
      {
        courseId: pickCourseId({ chapter, primaryCourseId }),
        courseIds: chapter.courses.map((placement) => placement.courseId),
        title: chapter.title,
      },
    ]),
  );
}

/**
 * Loads a goal's skills with the learner's state on each (New, Learning, Solid, Mastered and
 * fading), their prerequisites inside the goal and the chapter and phase each sits in, plus where
 * the learner is now. The field map and the chapter pages read it, so both draw the same nodes.
 */
export async function loadGoalMap({
  goal,
}: {
  goal: Pick<Goal, "id" | "primaryCourseId" | "userId">;
}): Promise<GoalMap> {
  const now = new Date();
  const [graph, rows] = await Promise.all([loadGoalPlan(goal.id), loadPlanRows(goal.id)]);
  const skillIds = graph.skills.map((skill) => skill.id);

  // Areas without a chapter are phases ("phase:0"), which aren't ids a chapter query accepts.
  const chapterIds = [
    ...new Set([
      ...rows.items.flatMap((item) => item.chapterId ?? []),
      ...graph.skills.map((skill) => skill.areaId).filter((id) => isUuid(id)),
    ]),
  ];

  const [texts, learnerSkills, areaDetails] = await Promise.all([
    prisma.skill.findMany({
      select: { description: true, id: true, name: true },
      where: { id: { in: skillIds } },
    }),
    prisma.learnerSkill.findMany({ where: { skillId: { in: skillIds }, userId: goal.userId } }),
    loadAreaDetails({ chapterIds, primaryCourseId: goal.primaryCourseId }),
  ]);

  const textById = new Map(texts.map((row) => [row.id, row]));
  const learnerSkillById = new Map(learnerSkills.map((row) => [row.skillId, row]));
  const itemSkills = new Map(graph.items.map((entry) => [entry.id, entry.skillIds]));

  const nodes = graph.skills.flatMap((skill): MapNode[] => {
    const text = textById.get(skill.id);

    if (!text) {
      return [];
    }

    const status = toSkillStatus({ learnerSkill: learnerSkillById.get(skill.id), now });

    return [
      {
        areaId: skill.areaId,
        phase: skill.phase,
        skill: {
          description: text.description,
          fading: status.fading,
          name: text.name,
          prerequisiteIds: [...skill.prerequisiteIds],
          retrievability: status.retrievability,
          skillId: skill.id,
          state: status.state,
        },
        title: skill.areaTitle,
      },
    ];
  });

  const items = rows.items.map((item) => ({ ...item, skillIds: itemSkills.get(item.id) ?? [] }));

  const built = buildGoalMapAreas({ areaDetails, items, nodes, phaseNames: rows.phaseNames });

  const courseIds = built.areas.flatMap((area) => {
    const details = areaDetails.get(area.areaId);
    return [area.courseId ?? [], details?.courseIds ?? []].flat();
  });

  return { ...built, courseIds: [...new Set(courseIds)], items };
}

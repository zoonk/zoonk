import "server-only";
import { type PlanItem, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { parsePlanGraph, parsePlanPhases } from "../../plans/planner/plan-state";
import { type PlacementSkill } from "../placement/placement-graph";
import { loadSkillSurvivors } from "./update-learner-skill";

/**
 * A goal skill with the area it belongs to (its chapter, or its plan phase without one), below its
 * section (`sectionTitle`): the course the skill graph put it in, such as an exam's subject or one
 * course of a goal that spans several.
 */
export type GoalSkillNode = PlacementSkill & { areaId: string; areaTitle: string };

type PlanItemRow = Pick<
  PlanItem,
  "chapterId" | "id" | "kind" | "lessonId" | "phase" | "skillId" | "status" | "titleSnapshot"
>;

type SkillEntry = { areaId: string; phase: number; planItemId: string; skillId: string };

/** A plan item with the skills it teaches, for marking what a learner already knows. */
export type GoalPlanItem = Pick<PlanItem, "id" | "status"> & { skillIds: string[] };

export type GoalPlan = { items: GoalPlanItem[]; skills: GoalSkillNode[] };

function unique<TValue>(values: readonly (TValue | null)[]): TValue[] {
  return [...new Set(values.filter((value) => value !== null))];
}

function getPhaseAreaId(phase: number): string {
  return `phase:${phase}`;
}

async function loadItemSkills(items: readonly PlanItemRow[]) {
  const lessonIds = unique(items.map((item) => item.lessonId));

  const chapterIds = unique(
    items.filter((item) => !item.lessonId && !item.skillId).map((item) => item.chapterId),
  );

  const [lessonSkills, chapterLessons] = await Promise.all([
    prisma.lessonSkill.findMany({
      orderBy: { createdAt: "asc" },
      select: { lesson: { select: { homeChapterId: true } }, lessonId: true, skillId: true },
      where: { lessonId: { in: lessonIds } },
    }),
    prisma.chapterLesson.findMany({
      orderBy: { position: "asc" },
      select: {
        chapterId: true,
        lesson: {
          select: { skills: { orderBy: { createdAt: "asc" }, select: { skillId: true } } },
        },
      },
      where: { chapterId: { in: chapterIds } },
    }),
  ]);

  return { chapterLessons, lessonSkills };
}

/**
 * Expands one plan item into its skills in teaching order: the item's own skill, the skills its
 * lesson teaches, or every skill of its chapter's lessons.
 */
function expandItem({
  item,
  skills,
}: {
  item: PlanItemRow;
  skills: Awaited<ReturnType<typeof loadItemSkills>>;
}): SkillEntry[] {
  const fallbackArea = item.chapterId ?? getPhaseAreaId(item.phase);
  const base = { phase: item.phase, planItemId: item.id };

  if (item.skillId) {
    return [{ ...base, areaId: fallbackArea, skillId: item.skillId }];
  }

  if (item.lessonId) {
    return skills.lessonSkills
      .filter((row) => row.lessonId === item.lessonId)
      .map((row) => ({
        ...base,
        areaId: item.chapterId ?? row.lesson.homeChapterId ?? fallbackArea,
        skillId: row.skillId,
      }));
  }

  return skills.chapterLessons
    .filter((row) => row.chapterId === item.chapterId)
    .flatMap((row) => row.lesson.skills)
    .map((row) => ({ ...base, areaId: fallbackArea, skillId: row.skillId }));
}

/** Plan items may still point at a merged skill; the learner's state lives on the survivor. */
async function toSurvivingSkills(entries: readonly SkillEntry[]): Promise<SkillEntry[]> {
  const survivorOf = await loadSkillSurvivors(unique(entries.map((entry) => entry.skillId)));
  return entries.map((entry) => ({ ...entry, skillId: survivorOf(entry.skillId) }));
}

function firstPerSkill(entries: readonly SkillEntry[]): SkillEntry[] {
  return entries.filter(
    (entry, index) => entries.findIndex((other) => other.skillId === entry.skillId) === index,
  );
}

async function loadAreaTitles({
  entries,
  items,
  phases,
}: {
  entries: readonly SkillEntry[];
  items: readonly PlanItemRow[];
  phases: unknown;
}): Promise<Map<string, string>> {
  // Areas without a chapter are phases ("phase:0"), which aren't ids a chapter query accepts.
  const chapterIds = unique(entries.map((entry) => entry.areaId)).filter((id) => isUuid(id));

  const chapters = await prisma.chapter.findMany({
    select: { id: true, title: true },
    where: { id: { in: chapterIds } },
  });

  const phaseTitles = parsePlanPhases(phases).map((phase, index): [string, string] => [
    getPhaseAreaId(index),
    phase.name,
  ]);

  const snapshots = items
    .filter((item) => item.kind === "chapter" && item.chapterId)
    .map((item): [string, string] => [item.chapterId ?? "", item.titleSnapshot]);

  return new Map([
    ...phaseTitles,
    ...snapshots,
    ...chapters.map((chapter): [string, string] => [chapter.id, chapter.title]),
  ]);
}

/**
 * The goal's skills from its skill graph, for a plan whose items no longer carry any: a re-plan
 * with no room left (a class test opened only the day before) drops every lesson, and the mock
 * and reviews still need the goal's skills.
 */
function toGraphEntries(graph: unknown): SkillEntry[] {
  return parsePlanGraph(graph).skills.map((skill) => ({
    areaId: getPhaseAreaId(skill.phase),
    phase: skill.phase,
    planItemId: "",
    skillId: skill.skillId,
  }));
}

/**
 * Loads the skills a goal's plan covers, in plan order, with their phase, area and prerequisites
 * inside the goal, plus each plan item's skills. The skills are the graph placement walks and
 * preparation measures. A goal without a plan has no skills yet; a plan whose items lost every
 * skill falls back to its skill graph's.
 */
export async function loadGoalPlan(goalId: string): Promise<GoalPlan> {
  const plan = await prisma.plan.findUnique({
    select: {
      graph: true,
      items: {
        orderBy: { position: "asc" },
        select: {
          chapterId: true,
          id: true,
          kind: true,
          lessonId: true,
          phase: true,
          skillId: true,
          status: true,
          titleSnapshot: true,
        },
      },
      phases: true,
    },
    where: { goalId },
  });

  if (!plan) {
    return { items: [], skills: [] };
  }

  const itemSkills = await loadItemSkills(plan.items);

  const itemEntries = plan.items.flatMap((item) => expandItem({ item, skills: itemSkills }));

  const allEntries = await toSurvivingSkills(
    itemEntries.length > 0 ? itemEntries : toGraphEntries(plan.graph),
  );

  const entries = firstPerSkill(allEntries);
  const skillIds = entries.map((entry) => entry.skillId);

  const [titles, edges] = await Promise.all([
    loadAreaTitles({ entries, items: plan.items, phases: plan.phases }),
    prisma.skillPrerequisite.findMany({
      select: { prerequisiteId: true, skillId: true },
      where: { prerequisiteId: { in: skillIds }, skillId: { in: skillIds } },
    }),
  ]);

  const sections = new Map(
    parsePlanGraph(plan.graph).skills.map((skill) => [skill.skillId, skill.area]),
  );

  return {
    items: plan.items.map((item) => ({
      id: item.id,
      skillIds: unique(
        allEntries.filter((entry) => entry.planItemId === item.id).map((entry) => entry.skillId),
      ),
      status: item.status,
    })),
    skills: entries.map((entry, order) => ({
      areaId: entry.areaId,
      areaTitle: titles.get(entry.areaId) ?? "",
      id: entry.skillId,
      order,
      phase: entry.phase,
      prerequisiteIds: edges
        .filter((edge) => edge.skillId === entry.skillId)
        .map((edge) => edge.prerequisiteId),
      sectionTitle: sections.get(entry.skillId) ?? null,
    })),
  };
}

/** The ids of every skill a goal's plan covers, in plan order. */
export async function loadGoalSkillIds(goalId: string): Promise<string[]> {
  const plan = await loadGoalPlan(goalId);
  return plan.skills.map((skill) => skill.id);
}

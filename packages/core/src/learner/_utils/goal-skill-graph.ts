import "server-only";
import { type PlanItem, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getFoundationSkillIds, getSkillArea } from "../../plans/planner/graph-areas";
import { parsePlanGraph, parsePlanPhases, parsePlanSettings } from "../../plans/planner/plan-state";
import { type PlacementSkill } from "../placement/placement-graph";
import { loadSkillSurvivors } from "./update-learner-skill";

/**
 * A goal skill with the area it belongs to (its chapter, or its plan phase without one), below its
 * section (`sectionTitle`): the course the skill graph put it in, such as an exam's subject or one
 * course of a goal that spans several. `memberSkillIds` are the skill and the finer skills its
 * planned Library lessons teach, where the learner's answers in those lessons land.
 */
export type GoalSkillNode = PlacementSkill & {
  areaId: string;
  areaTitle: string;
  memberSkillIds: string[];
};

type PlanItemRow = Pick<
  PlanItem,
  "chapterId" | "id" | "kind" | "lessonId" | "phase" | "skillId" | "status" | "titleSnapshot"
>;

type SkillEntry = { areaId: string; phase: number; planItemId: string; skillId: string };

/**
 * A plan item with the skills it teaches and the chapter it's planned in, for marking what a
 * learner already knows.
 */
export type GoalPlanItem = Pick<PlanItem, "chapterId" | "id" | "status"> & { skillIds: string[] };

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

/** A finer skill a lesson planned for one of the graph's skills teaches. */
type MemberEntry = { memberId: string; skillId: string };

/**
 * A lesson planned for one of the graph's skills teaches its own one to three skills, and the
 * learner's answers in it are recorded on those: each becomes a member of the plan skill.
 */
function toMemberEntries({
  items,
  skills,
}: {
  items: readonly PlanItemRow[];
  skills: Awaited<ReturnType<typeof loadItemSkills>>;
}): MemberEntry[] {
  const byLesson = Map.groupBy(skills.lessonSkills, (row) => row.lessonId);

  return items.flatMap((item) => {
    const { lessonId, skillId } = item;

    return skillId && lessonId
      ? (byLesson.get(lessonId) ?? []).map((row) => ({ memberId: row.skillId, skillId }))
      : [];
  });
}

async function toSurvivingMembers(entries: readonly MemberEntry[]): Promise<MemberEntry[]> {
  const survivorOf = await loadSkillSurvivors(
    unique(entries.flatMap((entry) => [entry.memberId, entry.skillId])),
  );

  return entries.map((entry) => ({
    memberId: survivorOf(entry.memberId),
    skillId: survivorOf(entry.skillId),
  }));
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
 * The skill graph's skills the plan's items don't hold, in the graph's order: what the learner's
 * time leaves out for now, never an area they took out of the plan.
 */
function toLeftOutEntries({
  graph,
  planned,
  settings,
}: {
  graph: unknown;
  planned: readonly SkillEntry[];
  settings: unknown;
}): SkillEntry[] {
  const parsed = parsePlanGraph(graph);
  const skipped = new Set(parsePlanSettings(settings).skippedAreas);
  const plannedIds = new Set(planned.map((entry) => entry.skillId));

  return toGraphEntries(graph).filter((entry, index) => {
    const skill = parsed.skills[index];

    return (
      skill !== undefined &&
      !plannedIds.has(entry.skillId) &&
      !skipped.has(getSkillArea({ graph: parsed, skill }))
    );
  });
}

/**
 * Loads the skills a goal's plan covers, in plan order, with their phase, area, band and
 * prerequisites inside the goal, plus each plan item's skills. With `withLeftOut`, the skill
 * graph's skills the plan's items leave out follow them (see `loadPlacementPlan`). A goal without
 * a plan has no skills yet; a plan whose items lost every skill falls back to its skill graph's.
 */
async function loadPlan({
  goalId,
  withLeftOut,
}: {
  goalId: string;
  withLeftOut: boolean;
}): Promise<GoalPlan> {
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
      settings: true,
    },
    where: { goalId },
  });

  if (!plan) {
    return { items: [], skills: [] };
  }

  const itemSkills = await loadItemSkills(plan.items);

  const itemEntries = plan.items.flatMap((item) => expandItem({ item, skills: itemSkills }));
  const planned = itemEntries.length > 0 ? itemEntries : toGraphEntries(plan.graph);

  const leftOut = withLeftOut
    ? toLeftOutEntries({ graph: plan.graph, planned, settings: plan.settings })
    : [];

  const [allEntries, members] = await Promise.all([
    toSurvivingSkills([...planned, ...leftOut]),
    toSurvivingMembers(toMemberEntries({ items: plan.items, skills: itemSkills })),
  ]);

  const membersOf = Map.groupBy(members, (entry) => entry.skillId);

  const entries = firstPerSkill(allEntries);
  const skillIds = entries.map((entry) => entry.skillId);

  const [titles, edges, bands] = await Promise.all([
    loadAreaTitles({ entries, items: plan.items, phases: plan.phases }),
    prisma.skillPrerequisite.findMany({
      select: { prerequisiteId: true, skillId: true },
      where: { prerequisiteId: { in: skillIds }, skillId: { in: skillIds } },
    }),
    prisma.skill.findMany({ select: { id: true, level: true }, where: { id: { in: skillIds } } }),
  ]);

  const graph = parsePlanGraph(plan.graph);
  const sections = new Map(graph.skills.map((skill) => [skill.skillId, skill.area]));
  const foundations = getFoundationSkillIds(graph);

  const bandOf = new Map(bands.map((skill) => [skill.id, skill.level]));

  // A lesson can teach a skill the graph doesn't name; it belongs to the subject of the plan item
  // that teaches it, so what placement learns about that subject reaches it too. Graph skills
  // without a plan item have no item to share a subject through.
  const itemSections = new Map(
    allEntries.flatMap((entry) => {
      const section = sections.get(entry.skillId);
      return section && entry.planItemId ? [[entry.planItemId, section] as const] : [];
    }),
  );

  return {
    items: plan.items.map((item) => ({
      chapterId: item.chapterId,
      id: item.id,
      skillIds: unique(
        allEntries.filter((entry) => entry.planItemId === item.id).map((entry) => entry.skillId),
      ),
      status: item.status,
    })),
    skills: entries.map((entry, order) => ({
      areaId: entry.areaId,
      areaTitle: titles.get(entry.areaId) ?? "",
      band: bandOf.get(entry.skillId) ?? null,
      foundation: foundations.has(entry.skillId),
      id: entry.skillId,
      memberSkillIds: unique([
        entry.skillId,
        ...(membersOf.get(entry.skillId) ?? []).map((member) => member.memberId),
      ]),
      order,
      phase: entry.phase,
      prerequisiteIds: edges
        .filter((edge) => edge.skillId === entry.skillId)
        .map((edge) => edge.prerequisiteId),
      sectionTitle: sections.get(entry.skillId) ?? itemSections.get(entry.planItemId) ?? null,
    })),
  };
}

/** The skills a goal's plan covers: what preparation, sessions and the plan's screens measure. */
export function loadGoalPlan(goalId: string): Promise<GoalPlan> {
  return loadPlan({ goalId, withLeftOut: false });
}

/**
 * The goal's plan with every skill of its skill graph, the ones the plan's items leave out after
 * its own: the skills placement places the learner on. Placement runs before the learner picks
 * their time, while the plan holds only what the default time fits (an ENEM plan at 15 minutes a
 * day had only its essay), and what the learner already knows decides what fits once they pick
 * it, so placement asks every subject the goal has, and its questions are written for the graph's
 * skills too.
 */
export function loadPlacementPlan(goalId: string): Promise<GoalPlan> {
  return loadPlan({ goalId, withLeftOut: true });
}

/** The ids of every skill a goal's plan covers, in plan order. */
export async function loadGoalSkillIds(goalId: string): Promise<string[]> {
  const plan = await loadGoalPlan(goalId);
  return plan.skills.map((skill) => skill.id);
}

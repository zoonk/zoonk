import "server-only";
import { type PlanItem, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { loadListeningSkillIds } from "../../exams/listening/listening-skills";
import { getFoundationSkillIds, getSkillArea } from "../../plans/planner/graph-areas";
import { parsePlanGraph, parsePlanPhases, parsePlanSettings } from "../../plans/planner/plan-state";
import { type PlacementSkill } from "../placement/placement-graph";
import {
  type ItemSkillRows,
  type SkillEntry,
  expandItem,
  firstPerSkill,
  getPhaseAreaId,
  toGraphEntries,
  unique,
} from "./goal-plan-projection";
import { type GoalPlanSource, type PlanItemRow, loadSavedGoalPlanSource } from "./goal-plan-source";
import { loadSkillSurvivors } from "./update-learner-skill";

export { type GoalPlanSource } from "./goal-plan-source";

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

/**
 * A plan item with the skills it teaches and the chapter it's planned in, for marking what a
 * learner already knows.
 */
export type GoalPlanItem = Pick<PlanItem, "chapterId" | "id" | "status"> & { skillIds: string[] };

export type GoalPlan = { items: GoalPlanItem[]; skills: GoalSkillNode[] };

/** The skills the Library says plan items' lessons and chapters teach (see `ItemSkillRows`). */
export async function loadItemSkillRows({
  chapterIds,
  lessonIds,
}: {
  chapterIds: readonly string[];
  lessonIds: readonly string[];
}): Promise<ItemSkillRows> {
  const [lessonSkills, chapterLessons] = await Promise.all([
    lessonIds.length === 0
      ? []
      : prisma.lessonSkill.findMany({
          orderBy: [{ createdAt: "asc" }, { skillId: "asc" }],
          select: { lesson: { select: { homeChapterId: true } }, lessonId: true, skillId: true },
          where: { lessonId: { in: [...lessonIds] } },
        }),
    chapterIds.length === 0
      ? []
      : prisma.chapterLesson.findMany({
          orderBy: { position: "asc" },
          select: {
            chapterId: true,
            lesson: {
              select: {
                skills: {
                  orderBy: [{ createdAt: "asc" }, { skillId: "asc" }],
                  select: { skillId: true },
                },
              },
            },
          },
          where: { chapterId: { in: [...chapterIds] } },
        }),
  ]);

  return { chapterLessons, lessonSkills };
}

/** The rows a saved plan's items need (see `loadItemSkillRows`). */
function loadItemSkills(items: readonly PlanItemRow[]): Promise<ItemSkillRows> {
  return loadItemSkillRows({
    chapterIds: unique(
      items.filter((item) => !item.lessonId && !item.skillId).map((item) => item.chapterId),
    ),
    lessonIds: unique(items.map((item) => item.lessonId)),
  });
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
  skills: ItemSkillRows;
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
export async function toSurvivingSkills(entries: readonly SkillEntry[]): Promise<SkillEntry[]> {
  const survivorOf = await loadSkillSurvivors(unique(entries.map((entry) => entry.skillId)));
  return entries.map((entry) => ({ ...entry, skillId: survivorOf(entry.skillId) }));
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

/** A goal skill and the finer skills its lessons teach, which count for it. */
function toMemberSkillIds(skillId: string, membersOf: ReadonlyMap<string, MemberEntry[]>) {
  return unique([skillId, ...(membersOf.get(skillId) ?? []).map((member) => member.memberId)]);
}

/**
 * The raw teaching entries and rows shared by the full skill projection and test-out eligibility.
 * Null without a plan; a plan whose items lost every skill falls back to its skill graph's.
 */
export async function loadPlanEntryRows({
  goalId,
  source,
  withLeftOut,
}: {
  goalId: string;
  source?: GoalPlanSource;
  withLeftOut: boolean;
}) {
  const plan = source ?? (await loadSavedGoalPlanSource(goalId));

  if (!plan) {
    return null;
  }

  const itemSkills = await loadItemSkills(plan.items);

  const itemEntries = plan.items.flatMap((item) => expandItem({ item, skills: itemSkills }));
  const planned = itemEntries.length > 0 ? itemEntries : toGraphEntries(plan.graph);

  const leftOut = withLeftOut
    ? toLeftOutEntries({ graph: plan.graph, planned, settings: plan.settings })
    : [];

  return { allEntries: [...planned, ...leftOut], itemSkills, plan };
}

async function loadPlanEntries(input: Parameters<typeof loadPlanEntryRows>[0]) {
  const loaded = await loadPlanEntryRows(input);

  if (!loaded) {
    return null;
  }

  const [allEntries, members] = await Promise.all([
    toSurvivingSkills(loaded.allEntries),
    toSurvivingMembers(toMemberEntries({ items: loaded.plan.items, skills: loaded.itemSkills })),
  ]);

  return {
    ...loaded,
    allEntries,
    entries: firstPerSkill(allEntries),
    membersOf: Map.groupBy(members, (entry) => entry.skillId),
  };
}

/**
 * Loads the skills a goal's plan covers, in plan order, with their phase, area, band and
 * prerequisites inside the goal, plus each plan item's skills. With `withLeftOut`, the skill
 * graph's skills the plan's items leave out follow them (see `loadPlacementPlan`). A goal without
 * a plan has no skills yet; a plan whose items lost every skill falls back to its skill graph's.
 */
async function loadPlan({
  goalId,
  source,
  withLeftOut,
}: {
  goalId: string;
  source?: GoalPlanSource;
  withLeftOut: boolean;
}): Promise<GoalPlan> {
  const loaded = await loadPlanEntries({ goalId, source, withLeftOut });

  if (!loaded) {
    return { items: [], skills: [] };
  }

  const { allEntries, entries, membersOf, plan } = loaded;
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

  const foundations = getFoundationSkillIds({
    graph,
    prerequisites: new Map(
      [...Map.groupBy(edges, (edge) => edge.skillId)].map(([skillId, list]) => [
        skillId,
        list.map((edge) => edge.prerequisiteId),
      ]),
    ),
  });

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
      memberSkillIds: toMemberSkillIds(entry.skillId, membersOf),
      order,
      phase: entry.phase,
      prerequisiteIds: edges
        .filter((edge) => edge.skillId === entry.skillId)
        .map((edge) => edge.prerequisiteId),
      sectionTitle: sections.get(entry.skillId) ?? itemSections.get(entry.planItemId) ?? null,
    })),
  };
}

/**
 * Which of a goal's skills each answered skill counts for: a goal skill for itself, and a finer
 * skill its lessons teach (where their screens' answers and mistakes land) for the first goal skill
 * whose lessons teach it.
 */
export function getSkillOwners(
  skills: readonly Pick<GoalSkillNode, "id" | "memberSkillIds">[],
): Map<string, string> {
  return new Map([
    ...skills
      .toReversed()
      .flatMap((skill) => skill.memberSkillIds.map((id): [string, string] => [id, skill.id])),
    ...skills.map((skill): [string, string] => [skill.id, skill.id]),
  ]);
}

/**
 * Which goal skill each answered skill counts for (`getSkillOwners` of the goal's plan), with the
 * plan's raw skill graph: all the mistakes notebook needs of the plan, without the titles,
 * prerequisites and bands its screens read. Empty without a plan.
 */
export async function loadGoalSkillScope(
  goalId: string,
): Promise<{ graph: unknown; ownerOf: Map<string, string> }> {
  const loaded = await loadPlanEntries({ goalId, withLeftOut: false });

  if (!loaded) {
    return { graph: null, ownerOf: new Map() };
  }

  const skills = loaded.entries.map((entry) => ({
    id: entry.skillId,
    memberSkillIds: toMemberSkillIds(entry.skillId, loaded.membersOf),
  }));

  return { graph: loaded.plan.graph, ownerOf: getSkillOwners(skills) };
}

/** The skills a goal's plan covers: what preparation, sessions and the plan's screens measure. */
export function loadGoalPlan(goalId: string, source?: GoalPlanSource): Promise<GoalPlan> {
  return loadPlan({ goalId, source, withLeftOut: false });
}

/** A plan without the skills its exam practices only with recordings (`loadListeningSkillIds`). */
async function loadTextTestPlan({
  goalId,
  withLeftOut,
}: {
  goalId: string;
  withLeftOut: boolean;
}): Promise<GoalPlan> {
  const [plan, listening] = await Promise.all([
    loadPlan({ goalId, withLeftOut }),
    loadListeningSkillIds(goalId),
  ]);

  return { ...plan, skills: plan.skills.filter((skill) => !listening.has(skill.id)) };
}

/**
 * The goal's plan with every skill of its skill graph, the ones the plan's items leave out after
 * its own: the skills placement places the learner on. Placement runs before the learner picks
 * their time, while the plan holds only what the default time fits (an ENEM plan at 15 minutes a
 * day had only its essay), and what the learner already knows decides what fits once they pick
 * it, so placement asks every subject the goal has, and its questions are written for the graph's
 * skills too. Except the skills its exam practices only with recordings (`loadListeningSkillIds`):
 * a text question tests reading, not listening, so placement never asks or skips them, and their
 * lessons stay.
 */
export function loadPlacementPlan(goalId: string): Promise<GoalPlan> {
  return loadTextTestPlan({ goalId, withLeftOut: true });
}

/** The ids of every skill a goal's plan covers, in plan order. */
export async function loadGoalSkillIds(goalId: string): Promise<string[]> {
  const plan = await loadGoalPlan(goalId);
  return plan.skills.map((skill) => skill.id);
}

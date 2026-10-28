import "server-only";
import { type PlanItem, type TransactionClient, prisma } from "@zoonk/db";
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
import {
  type LibrarySource,
  readChapterTitles,
  readItemSkillRows,
  readSkillEdges,
  readSkillLevels,
  readSurvivorOf,
} from "./plan-library-rows";

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

/** The rows a saved plan's items need (see `loadItemSkillRows`). */
function loadItemSkills(
  items: readonly PlanItemRow[],
  from: LibrarySource,
): Promise<ItemSkillRows> {
  return readItemSkillRows(
    {
      chapterIds: unique(
        items.filter((item) => !item.lessonId && !item.skillId).map((item) => item.chapterId),
      ),
      lessonIds: unique(items.map((item) => item.lessonId)),
    },
    from,
  );
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

async function loadAreaTitles({
  entries,
  from,
  items,
  phases,
}: {
  entries: readonly SkillEntry[];
  from: LibrarySource;
  items: readonly PlanItemRow[];
  phases: unknown;
}): Promise<Map<string, string>> {
  // Areas without a chapter are phases ("phase:0"), which aren't ids a chapter query accepts.
  const chapterIds = unique(entries.map((entry) => entry.areaId)).filter((id) => isUuid(id));
  const chapters = await readChapterTitles(chapterIds, from);

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

type PlanRead = {
  goalId: string;
  /** A GET's reads take the Library's rows from shared caches (see `LibrarySource`). */
  sharedLibrary?: boolean;
  source?: GoalPlanSource;
  tx?: TransactionClient;
  withLeftOut: boolean;
};

function getLibrarySource({ sharedLibrary, tx = prisma }: PlanRead): LibrarySource {
  return sharedLibrary ? "shared" : tx;
}

/**
 * The raw teaching entries and rows shared by the full skill projection and test-out eligibility.
 * Null without a plan; a plan whose items lost every skill falls back to its skill graph's.
 */
async function loadPlanEntryRows(input: PlanRead) {
  const { goalId, source, withLeftOut, tx = prisma } = input;
  const plan = source ?? (await loadSavedGoalPlanSource(goalId, tx));

  if (!plan) {
    return null;
  }

  const itemSkills = await loadItemSkills(plan.items, getLibrarySource(input));

  const itemEntries = plan.items.flatMap((item) => expandItem({ item, skills: itemSkills }));
  const planned = itemEntries.length > 0 ? itemEntries : toGraphEntries(plan.graph);

  const leftOut = withLeftOut
    ? toLeftOutEntries({ graph: plan.graph, planned, settings: plan.settings })
    : [];

  return { allEntries: [...planned, ...leftOut], itemSkills, plan };
}

/**
 * The plan's teaching entries with merged skills resolved to their survivors, and each goal skill's
 * finer member skills: what the full projection (`loadPlan`) and test-outs build on.
 */
export async function loadPlanEntries(input: PlanRead) {
  const loaded = await loadPlanEntryRows(input);

  if (!loaded) {
    return null;
  }

  const members = toMemberEntries({ items: loaded.plan.items, skills: loaded.itemSkills });

  const survivorOf = await readSurvivorOf(
    unique([
      ...loaded.allEntries.map((entry) => entry.skillId),
      ...members.flatMap((entry) => [entry.memberId, entry.skillId]),
    ]),
    getLibrarySource(input),
  );

  const allEntries = loaded.allEntries.map((entry) => ({
    ...entry,
    skillId: survivorOf(entry.skillId),
  }));

  const survivingMembers = members.map((entry) => ({
    memberId: survivorOf(entry.memberId),
    skillId: survivorOf(entry.skillId),
  }));

  return {
    ...loaded,
    allEntries,
    entries: firstPerSkill(allEntries),
    membersOf: Map.groupBy(survivingMembers, (entry) => entry.skillId),
  };
}

/**
 * Loads the skills a goal's plan covers, in plan order, with their phase, area, band and
 * prerequisites inside the goal, plus each plan item's skills. With `withLeftOut`, the skill
 * graph's skills the plan's items leave out follow them (see `loadPlacementPlan`). A goal without
 * a plan has no skills yet; a plan whose items lost every skill falls back to its skill graph's.
 */
async function loadPlan(input: PlanRead): Promise<GoalPlan> {
  const loaded = await loadPlanEntries(input);
  const from = getLibrarySource(input);

  if (!loaded) {
    return { items: [], skills: [] };
  }

  const { allEntries, entries, membersOf, plan } = loaded;
  const skillIds = entries.map((entry) => entry.skillId);

  const [titles, edges, bands] = await Promise.all([
    loadAreaTitles({ entries, from, items: plan.items, phases: plan.phases }),
    readSkillEdges(skillIds, from),
    readSkillLevels(skillIds, from),
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
 * The skills a goal's plan covers: what preparation, sessions and the plan's screens measure. A
 * GET (`readGoalPlan`) passes `sharedLibrary`; writes read the Library fresh.
 */
export function loadGoalPlan(
  goalId: string,
  source?: GoalPlanSource,
  { sharedLibrary = false }: { sharedLibrary?: boolean } = {},
): Promise<GoalPlan> {
  return loadPlan({ goalId, sharedLibrary, source, withLeftOut: false });
}

/** A plan without the skills its exam practices only with recordings (`loadListeningSkillIds`). */
async function loadTextTestPlan({ goalId, withLeftOut, tx = prisma }: PlanRead): Promise<GoalPlan> {
  const [plan, listening] = await Promise.all([
    loadPlan({ goalId, tx, withLeftOut }),
    loadListeningSkillIds(goalId, tx),
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
export function loadPlacementPlan(
  goalId: string,
  tx: TransactionClient = prisma,
): Promise<GoalPlan> {
  return loadTextTestPlan({ goalId, tx, withLeftOut: true });
}

/** The ids of every skill a goal's plan covers, in plan order. */
export async function loadGoalSkillIds(goalId: string): Promise<string[]> {
  const plan = await loadGoalPlan(goalId);
  return plan.skills.map((skill) => skill.id);
}

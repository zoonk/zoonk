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

/** memberSkillIds includes finer lesson skills on which learner answers are recorded. */
export type GoalSkillNode = PlacementSkill & {
  areaId: string;
  areaTitle: string;
  memberSkillIds: string[];
};

export type GoalPlanItem = Pick<PlanItem, "chapterId" | "id" | "status"> & { skillIds: string[] };

export type GoalPlan = { items: GoalPlanItem[]; skills: GoalSkillNode[] };

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

type MemberEntry = { memberId: string; skillId: string };

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

/** Returns null without a plan and resolves merged skills to their survivors. */
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

/** GETs pass sharedLibrary; writes must use fresh Library reads. */
export function loadGoalPlan(
  goalId: string,
  source?: GoalPlanSource,
  { sharedLibrary = false }: { sharedLibrary?: boolean } = {},
): Promise<GoalPlan> {
  return loadPlan({ goalId, sharedLibrary, source, withLeftOut: false });
}

async function loadTextTestPlan({ goalId, withLeftOut, tx = prisma }: PlanRead): Promise<GoalPlan> {
  const [plan, listening] = await Promise.all([
    loadPlan({ goalId, tx, withLeftOut }),
    loadListeningSkillIds(goalId, tx),
  ]);

  return { ...plan, skills: plan.skills.filter((skill) => !listening.has(skill.id)) };
}

/** Includes left-out graph skills for placement, but excludes listening-only skills that text questions cannot test. */
export function loadPlacementPlan(
  goalId: string,
  tx: TransactionClient = prisma,
): Promise<GoalPlan> {
  return loadTextTestPlan({ goalId, tx, withLeftOut: true });
}

/** Preserves plan order. */
export async function loadGoalSkillIds(goalId: string): Promise<string[]> {
  const plan = await loadGoalPlan(goalId);
  return plan.skills.map((skill) => skill.id);
}

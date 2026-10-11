import "server-only";
import { type CourseLevel, type Goal, prisma } from "@zoonk/db";
import { namesMatch } from "../../exams/_utils/name-match";
import { loadListeningExam } from "../../exams/listening/listening-exam";
import { getListeningSkillIds } from "../../exams/listening/listening-skills";
import { getKnownSubjects, getOwnLevel } from "../../learner/placement/placement-contract";
import { type PlacementSkill, getBandRank } from "../../learner/placement/placement-graph";
import { loadSkillPrerequisites } from "../../library/skills/skill-prerequisites";
import { getAreaFoundationIds, getAreasOf } from "../planner/graph-areas";
import { type PlanEffect } from "../planner/plan-effect";
import {
  type PlanGraph,
  type PlanState,
  parsePlanGraph,
  parsePlanSettings,
} from "../planner/plan-state";
import { getLevelFloor } from "./level-bands";
import { parsePlanChangePayload } from "./plan-change-payload";

/** The areas whose start the learner already chose in the plan (`setAreaStart`), either way. */
async function listChosenStartAreas(planId: string): Promise<Set<string>> {
  const changes = await prisma.planChange.findMany({
    select: { payload: true },
    where: {
      payload: { array_contains: [{ kind: "setAreaStart" }], path: ["operations"] },
      planId,
      status: "applied",
    },
  });

  return new Set(
    changes.flatMap((change) =>
      parsePlanChangePayload(change.payload).operations.flatMap((operation) =>
        operation.kind === "setAreaStart" ? operation.areas : [],
      ),
    ),
  );
}

/**
 * The exam's listening areas the learner's own word starts past the basics of, as if they had said
 * those lessons are too basic (`PlanSettings.pastBasicsAreas`): all of them for someone who studied
 * the language before or knows it well (`getLevelFloor`), and the ones they said they know well
 * (`getKnownSubjects`, whose step says "Your plan starts past their basics"). Placement never asks
 * a listening skill (a text question tests reading), so an IELTS candidate who studied English
 * before met its sound drills on day one. The basics stay to confirm: practice asks them with
 * recordings, and a miss brings their lessons back (see `listPassedOver`). None for a lower level,
 * a goal without listening, or an area whose start the learner already chose (`chosen`).
 *
 * @internal The simulator's pure tier settles plans with it; the apps go through
 * `listListeningPastBasicsAreas`.
 */
export function pickListeningPastBasicsAreas({
  chosen,
  goal,
  graph,
  listening,
}: {
  chosen: ReadonlySet<string>;
  goal: Pick<Goal, "details">;
  graph: PlanGraph;
  listening: ReadonlySet<string>;
}): string[] {
  const levelCovers = getLevelFloor(getOwnLevel({ goal })) !== null;
  const known = getKnownSubjects(goal);
  const saysKnown = (area: string) => known.some((subject) => namesMatch(area, subject));

  return [...getAreasOf({ graph, skillIds: listening })].filter(
    (area) => !chosen.has(area) && (levelCovers || saysKnown(area)),
  );
}

/**
 * `pickListeningPastBasicsAreas` for a plan, reading the exam's listening skills and the starts
 * the learner chose only when their word could start one past the basics.
 */
export async function listListeningPastBasicsAreas({
  goal,
  graph,
  planId,
}: {
  goal: Pick<Goal, "details" | "id">;
  graph: PlanGraph;
  planId: string;
}): Promise<string[]> {
  if (getLevelFloor(getOwnLevel({ goal })) === null && getKnownSubjects(goal).length === 0) {
    return [];
  }

  const exam = await loadListeningExam(goal.id);
  const listening = getListeningSkillIds({ exam, graph });

  if (listening.size === 0) {
    return [];
  }

  const chosen = await listChosenStartAreas(planId);
  return pickListeningPastBasicsAreas({ chosen, goal, graph, listening });
}

/** The ones of these areas the plan doesn't start past their basics yet. */
function listNewPastBasicsAreas({
  areas,
  state,
}: {
  areas: readonly string[];
  state: PlanState;
}): string[] {
  return areas.filter((area) => !state.settings.pastBasicsAreas.includes(area));
}

/** The plan's state with these areas past their basics too (`PlanSettings.pastBasicsAreas`). */
export function withPastBasicsAreas({
  areas,
  state,
}: {
  areas: readonly string[];
  state: PlanState;
}): PlanState {
  const added = listNewPastBasicsAreas({ areas, state });

  return added.length === 0
    ? state
    : {
        ...state,
        settings: {
          ...state.settings,
          pastBasicsAreas: [...state.settings.pastBasicsAreas, ...added],
        },
      };
}

/**
 * What a change that starts placement's listening areas past their basics (`withPastBasicsAreas`)
 * adds to its effect, so its card says why their basics left (`PlanEffect.listeningPastBasics`).
 */
export function getListeningPastBasicsEffect({
  areas,
  state,
}: {
  areas: readonly string[];
  state: PlanState;
}): Pick<PlanEffect, "listeningPastBasics"> {
  const added = listNewPastBasicsAreas({ areas, state });
  return added.length > 0 ? { listeningPastBasics: added } : {};
}

/**
 * The highest Library band whose text skills placement's answers show known: more of them known
 * (`listKnownSkillIds`) than missed anywhere. Null when no band is.
 *
 * @internal Exported for its tests and the simulator; the apps go through
 * `listPlacementListeningAreas`.
 */
export function getPlacementConfirmedBand({
  knownSkillIds,
  missedSkillIds,
  skills,
}: {
  knownSkillIds: ReadonlySet<string>;
  missedSkillIds: ReadonlySet<string>;
  /** The text skills placement asks (a listening skill is never one). */
  skills: readonly Pick<PlacementSkill, "band" | "id">[];
}): CourseLevel | null {
  const byBand = Map.groupBy(
    skills.flatMap((skill) => (skill.band ? [{ band: skill.band, id: skill.id }] : [])),
    (skill) => skill.band,
  );

  const confirmed = [...byBand].flatMap(([band, bandSkills]) => {
    const known = bandSkills.filter((skill) => knownSkillIds.has(skill.id)).length;

    const missed = bandSkills.filter(
      (skill) => missedSkillIds.has(skill.id) && !knownSkillIds.has(skill.id),
    ).length;

    return known > missed ? [band] : [];
  });

  return confirmed.toSorted((a, b) => getBandRank(b) - getBandRank(a))[0] ?? null;
}

/**
 * The exam's listening areas placement's text answers start past the basics of, as if the learner
 * had said those lessons are too basic (the lead's decision of 10 Oct): placement never asks a
 * listening skill, so a learner who gave no level and showed the text basics known still met the
 * sound drills on day one. Only an area whose basics (`getAreaFoundationIds`) all sit at or below
 * the band placement confirmed (`getPlacementConfirmedBand`), as do the beginner lessons passing
 * the basics leaves out (`keepPastBasicsBands`). The basics stay to confirm: practice asks them
 * with recordings, and a miss brings their lessons back. None for an area whose start the learner
 * chose (`chosen`).
 *
 * @internal Exported for its tests and the simulator; the apps go through
 * `listPlacementListeningAreas`.
 */
export function pickPlacementListeningAreas({
  bands,
  chosen,
  confirmedBand,
  graph,
  listening,
  prerequisites,
}: {
  /** The Library band of each listening skill (`Skill.level`). */
  bands: ReadonlyMap<string, CourseLevel | null>;
  chosen: ReadonlySet<string>;
  confirmedBand: CourseLevel | null;
  graph: PlanGraph;
  listening: ReadonlySet<string>;
  prerequisites: ReadonlyMap<string, readonly string[]>;
}): string[] {
  if (!confirmedBand) {
    return [];
  }

  const reaches = (band: CourseLevel | null | undefined) =>
    band !== null && band !== undefined && getBandRank(band) <= getBandRank(confirmedBand);

  return [...getAreasOf({ graph, skillIds: listening })].filter(
    (area) =>
      !chosen.has(area) &&
      reaches("beginner") &&
      [...getAreaFoundationIds({ areas: new Set([area]), graph, prerequisites })].every((skillId) =>
        reaches(bands.get(skillId)),
      ),
  );
}

/** The skills among these the learner ever answered wrong or said they don't know yet. */
async function listMissedSkillIds({
  skillIds,
  userId,
}: {
  skillIds: readonly string[];
  userId: string;
}): Promise<Set<string>> {
  const missed = await prisma.attempt.findMany({
    distinct: ["skillId"],
    select: { skillId: true },
    where: { isCorrect: false, skillId: { in: [...skillIds] }, userId },
  });

  return new Set(missed.flatMap((attempt) => attempt.skillId ?? []));
}

/**
 * `pickPlacementListeningAreas` for a goal whose placement took `knownSkillIds` as known among its
 * text skills (`skills`), leaving out the areas already past their basics.
 */
export async function listPlacementListeningAreas({
  goalId,
  knownSkillIds,
  skills,
  userId,
}: {
  goalId: string;
  knownSkillIds: readonly string[];
  skills: readonly Pick<PlacementSkill, "band" | "id">[];
  userId: string;
}): Promise<string[]> {
  if (knownSkillIds.length === 0) {
    return [];
  }

  const [plan, exam] = await Promise.all([
    prisma.plan.findUnique({
      select: { graph: true, id: true, settings: true },
      where: { goalId },
    }),
    loadListeningExam(goalId),
  ]);

  const graph = parsePlanGraph(plan?.graph);
  const listening = getListeningSkillIds({ exam, graph });

  if (!plan || listening.size === 0) {
    return [];
  }

  const text = skills.filter((skill) => !listening.has(skill.id));

  const confirmedBand = getPlacementConfirmedBand({
    knownSkillIds: new Set(knownSkillIds),
    missedSkillIds: await listMissedSkillIds({ skillIds: text.map((skill) => skill.id), userId }),
    skills: text,
  });

  if (!confirmedBand) {
    return [];
  }

  const [prerequisites, bands, chosen] = await Promise.all([
    loadSkillPrerequisites(graph.skills.map((skill) => skill.skillId)),
    prisma.skill.findMany({
      select: { id: true, level: true },
      where: { id: { in: [...listening] } },
    }),
    listChosenStartAreas(plan.id),
  ]);

  const { pastBasicsAreas } = parsePlanSettings(plan.settings);

  return pickPlacementListeningAreas({
    bands: new Map(bands.map((skill) => [skill.id, skill.level])),
    chosen,
    confirmedBand,
    graph,
    listening,
    prerequisites,
  }).filter((area) => !pastBasicsAreas.includes(area));
}

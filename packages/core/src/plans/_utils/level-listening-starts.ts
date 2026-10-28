import { type CourseLevel, type Goal } from "@zoonk/db";
import { namesMatch } from "../../exams/_utils/name-match";
import { getKnownSubjects, getOwnLevel } from "../../learner/placement/placement-contract";
import { type PlacementSkill, getBandRank } from "../../learner/placement/placement-graph";
import { getAreaFoundationIds, getAreasOf } from "../planner/graph-areas";
import { type PlanEffect } from "../planner/plan-effect";
import { type PlanGraph, type PlanState } from "../planner/plan-state";
import { getLevelFloor } from "./level-bands";

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

function listNewPastBasicsAreas({
  areas,
  state,
}: {
  areas: readonly string[];
  state: PlanState;
}): string[] {
  return areas.filter((area) => !state.settings.pastBasicsAreas.includes(area));
}

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

export function getPlacementConfirmedBand({
  knownSkillIds,
  missedSkillIds,
  skills,
}: {
  knownSkillIds: ReadonlySet<string>;
  missedSkillIds: ReadonlySet<string>;
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

export function pickPlacementListeningAreas({
  bands,
  chosen,
  confirmedBand,
  graph,
  listening,
  prerequisites,
}: {
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

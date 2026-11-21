import { type Goal } from "@zoonk/db";
import { namesMatch } from "../../exams/_utils/name-match";
import { getKnownSubjects, getOwnLevel } from "../../learner/placement/placement-contract";
import { getAreasOf } from "../planner/graph-areas";
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

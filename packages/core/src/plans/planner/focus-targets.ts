import { getSkillArea } from "./graph-areas";
import { type PlanGraph, type PlanSettings } from "./plan-state";

/**
 * What a focus asks to come first or get more of, under the name the learner sees: a whole area,
 * or the part of one they named ("Biology and Chemistry" of ENEM's natural sciences).
 */
export type FocusTarget = { name: string; skillIds: ReadonlySet<string> };

/** The focus on each of these areas: its part when the learner named one, else all of it. */
export function getFocusTargets({
  areas,
  graph,
  settings,
}: {
  areas: readonly string[];
  graph: PlanGraph;
  settings: Pick<PlanSettings, "focusParts">;
}): FocusTarget[] {
  return areas.map((area) => {
    const part = settings.focusParts.find((focusPart) => focusPart.area === area);

    const skillIds = part
      ? part.skillIds
      : graph.skills
          .filter((skill) => getSkillArea({ graph, skill }) === area)
          .map((skill) => skill.skillId);

    return { name: part?.name ?? area, skillIds: new Set(skillIds) };
  });
}

/**
 * The skills of every focus the learner set (see `getFocusTargets`): their own answers take them as
 * known twice (see `meetsKnownBar`).
 */
export function listFocusedSkillIds({
  graph,
  settings,
}: {
  graph: PlanGraph;
  settings: Pick<PlanSettings, "focusAreas" | "focusParts">;
}): Set<string> {
  return new Set(
    getFocusTargets({ areas: settings.focusAreas, graph, settings }).flatMap((target) => [
      ...target.skillIds,
    ]),
  );
}

/** The name of the focus each skill counts for, or null for a skill outside every focus. */
export function getTargetOf(targets: readonly FocusTarget[]): (skillId: string) => string | null {
  return function targetOf(skillId) {
    return targets.find((target) => target.skillIds.has(skillId))?.name ?? null;
  };
}

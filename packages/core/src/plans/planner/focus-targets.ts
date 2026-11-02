import { getSkillArea } from "./graph-areas";
import { type PlanGraph, type PlanSettings } from "./plan-state";

export type FocusTarget = { name: string; skillIds: ReadonlySet<string> };

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

export function getTargetOf(targets: readonly FocusTarget[]): (skillId: string) => string | null {
  return function targetOf(skillId) {
    return targets.find((target) => target.skillIds.has(skillId))?.name ?? null;
  };
}

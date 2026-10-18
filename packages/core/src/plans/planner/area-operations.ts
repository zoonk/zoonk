import { type PlanOperation } from "../plan-contract";
import { getSkillArea } from "./graph-areas";
import { type FocusPart, type PlanSettings, type PlanState } from "./plan-state";

/**
 * The changes that name some of the plan's areas: focus, less time, skip, bring back, start past
 * basics.
 */
export type AreaOperation = Extract<
  PlanOperation,
  { kind: "focusAreas" | "reduceAreas" | "restoreAreas" | "setAreaStart" | "skipAreas" }
>;

const AREA_KINDS: ReadonlySet<PlanOperation["kind"]> = new Set([
  "focusAreas",
  "reduceAreas",
  "restoreAreas",
  "setAreaStart",
  "skipAreas",
]);

export function isAreaOperation(operation: PlanOperation): operation is AreaOperation {
  return AREA_KINDS.has(operation.kind);
}

function getAreas(state: PlanState): Set<string> {
  return new Set(state.graph.skills.map((skill) => getSkillArea({ graph: state.graph, skill })));
}

function without(list: readonly string[], areas: readonly string[]): string[] {
  return list.filter((area) => !areas.includes(area));
}

/**
 * The parts a focus narrows its areas to: the ones it names, each one's skills of its own area
 * only (a part left with none focuses its area whole), one per area; without any named, the ones
 * its areas already had.
 */
function toFocusParts({
  operation,
  state,
}: {
  operation: Extract<AreaOperation, { kind: "focusAreas" }>;
  state: PlanState;
}): FocusPart[] {
  const { areas, parts } = operation;

  if (!parts) {
    return state.settings.focusParts.filter((part) => areas.includes(part.area));
  }

  const areaOf = new Map(
    state.graph.skills.map((skill) => [skill.skillId, getSkillArea({ graph: state.graph, skill })]),
  );

  const named = parts.flatMap((part) => {
    const skillIds = [...new Set(part.skillIds)].filter((id) => areaOf.get(id) === part.area);
    return areas.includes(part.area) && skillIds.length > 0 ? [{ ...part, skillIds }] : [];
  });

  return named.filter(
    (part, index) => named.findIndex((other) => other.area === part.area) === index,
  );
}

/** What the change sets for its areas, the rest of the settings as they were. */
function updateSettings({
  operation,
  state,
}: {
  operation: AreaOperation;
  state: PlanState;
}): PlanSettings {
  const { settings } = state;
  const { areas } = operation;

  switch (operation.kind) {
    case "focusAreas":
      return {
        ...settings,
        focusAreas: [...areas],
        focusParts: toFocusParts({ operation, state }),
        reducedAreas: without(settings.reducedAreas, areas),
      };
    case "reduceAreas":
      return {
        ...settings,
        focusAreas: without(settings.focusAreas, areas),
        focusParts: settings.focusParts.filter((part) => !areas.includes(part.area)),
        reducedAreas: [...new Set([...settings.reducedAreas, ...areas])],
      };
    case "skipAreas":
      return {
        ...settings,
        focusAreas: without(settings.focusAreas, areas),
        focusParts: settings.focusParts.filter((part) => !areas.includes(part.area)),
        skippedAreas: [...new Set([...settings.skippedAreas, ...areas])],
      };
    case "restoreAreas":
      return {
        ...settings,
        reducedAreas: without(settings.reducedAreas, areas),
        skippedAreas: without(settings.skippedAreas, areas),
      };
    case "setAreaStart": {
      const others = without(settings.pastBasicsAreas, areas);
      const pastBasics = operation.start === "pastBasics" ? [...others, ...areas] : others;
      return { ...settings, pastBasicsAreas: pastBasics };
    }
    default:
      return operation satisfies never;
  }
}

/**
 * Applies a change to some of the plan's areas: only areas the plan has, and never one that
 * leaves every area out.
 */
export function applyAreaOperation({
  operation,
  state,
}: {
  operation: AreaOperation;
  state: PlanState;
}): { error: "nothingLeft" | "unknownArea" } | { state: PlanState } {
  const known = getAreas(state);

  if (operation.areas.some((area) => !known.has(area))) {
    return { error: "unknownArea" };
  }

  const settings = updateSettings({ operation, state });

  if ([...known].every((area) => settings.skippedAreas.includes(area))) {
    return { error: "nothingLeft" };
  }

  return { state: { ...state, settings } };
}

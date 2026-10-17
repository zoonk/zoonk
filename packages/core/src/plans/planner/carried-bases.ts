import { type ExistingPlanItem } from "./plan-items";
import { type QueueUnit } from "./plan-units";

/** The skills the learner began (a lesson of theirs isn't to do) or whose lessons today keeps. */
export function listBegunSkillIds({
  carried,
  items,
}: {
  carried: readonly QueueUnit[];
  items: readonly ExistingPlanItem[];
}): Set<string> {
  return new Set([
    ...items.flatMap((item) =>
      item.kind === "lesson" && item.status !== "todo" && item.skillId ? [item.skillId] : [],
    ),
    ...carried.flatMap((unit) => (unit.skillId ? [unit.skillId] : [])),
  ]);
}

/** The carried keys kept so far, and the skills begun by then. */
type CarriedKeeping = { kept: string[]; started: Set<string> };

/** A carried key stays first when its skill's bases are begun, carried before it, or all placed. */
function keepIfReady({
  key,
  prerequisites,
  skillOf,
  state,
  taught,
  today,
}: {
  key: string;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  skillOf: ReadonlyMap<string, string | null>;
  state: CarriedKeeping;
  taught: ReadonlySet<string>;
  today: ReadonlySet<string>;
}): CarriedKeeping {
  const skillId = skillOf.get(key) ?? null;

  const ready = (prerequisites.get(skillId ?? "") ?? []).every(
    (baseId) => !taught.has(baseId) || state.started.has(baseId),
  );

  if (!ready && !today.has(key)) {
    return state;
  }

  state.kept.push(key);
  state.started.add(skillId ?? "");
  return state;
}

/**
 * The carried work that stays first: a lesson whose skill builds on a skill the learner hasn't
 * begun, which the rest of the plan still teaches, waits for it among the rest (R16), unless that
 * one comes first in the carried work too or today keeps the lesson (R4). A lesson ENEM's
 * Linguagens shares with the skill it teaches, given on a day the learner didn't study, came back
 * before the quick lesson of the base that skill builds on.
 */
export function keepCarriedAfterBases({
  begun,
  keys,
  prerequisites,
  today,
  units,
}: {
  begun: ReadonlySet<string>;
  keys: readonly string[];
  prerequisites: ReadonlyMap<string, readonly string[]>;
  today: ReadonlySet<string>;
  units: readonly QueueUnit[];
}): string[] {
  const skillOf = new Map(units.map((unit) => [unit.key, unit.skillId]));
  const taught = new Set(units.flatMap((unit) => (unit.skillId ? [unit.skillId] : [])));

  return keys.reduce<CarriedKeeping>(
    (state, key) => keepIfReady({ key, prerequisites, skillOf, state, taught, today }),
    { kept: [], started: new Set(begun) },
  ).kept;
}

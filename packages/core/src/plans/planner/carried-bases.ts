import { type ExistingPlanItem } from "./plan-items";
import { type QueueUnit } from "./plan-units";

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

type CarriedKeeping = { kept: string[]; started: Set<string> };

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

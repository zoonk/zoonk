import { type QueueUnit } from "./plan-units";

export function keepCarriedBeforeChallenges({
  keys,
  today,
  units,
}: {
  keys: readonly string[];
  today: ReadonlySet<string>;
  units: readonly QueueUnit[];
}): string[] {
  const challenge = Math.min(
    ...units.flatMap((unit) => (unit.kind === "boss" ? [unit.phase] : [])),
  );

  const phases = new Map(units.map((unit) => [unit.key, unit.phase]));

  return keys.filter((key) => today.has(key) || (phases.get(key) ?? 0) <= challenge);
}

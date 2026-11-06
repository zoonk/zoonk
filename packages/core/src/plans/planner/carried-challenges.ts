import { type QueueUnit } from "./plan-units";

export function keepCarriedBeforeChallenges({
  given,
  keys,
  units,
}: {
  given: ReadonlySet<string>;
  keys: readonly string[];
  units: readonly QueueUnit[];
}): string[] {
  const challenge = Math.min(
    ...units.flatMap((unit) => (unit.kind === "boss" ? [unit.phase] : [])),
  );

  const phases = new Map(units.map((unit) => [unit.key, unit.phase]));

  return keys.filter((key) => given.has(key) || (phases.get(key) ?? 0) <= challenge);
}

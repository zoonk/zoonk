import { type QueueUnit } from "./plan-units";

export function holdBehindChallenges({
  keys,
  today,
  units,
}: {
  keys: readonly string[];
  today: ReadonlySet<string>;
  units: readonly QueueUnit[];
}): { held: string[]; kept: string[] } {
  const challenge = Math.min(
    ...units.flatMap((unit) => (unit.kind === "boss" ? [unit.phase] : [])),
  );

  const phases = new Map(units.map((unit) => [unit.key, unit.phase]));
  const waits = (key: string) => !today.has(key) && (phases.get(key) ?? 0) > challenge;

  return { held: keys.filter((key) => waits(key)), kept: keys.filter((key) => !waits(key)) };
}

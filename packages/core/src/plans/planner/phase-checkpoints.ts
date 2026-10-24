import { type QueueUnit, getBossKey } from "./plan-units";

/**
 * Adds a phase checkpoint after the last lesson of each phase. Units arrive grouped by phase, so
 * the checkpoint goes where the next phase begins; the last one closes the plan.
 */
export function addPhaseCheckpoints({
  getMinutes,
  phaseNames,
  units,
}: {
  /** A phase's boss's minutes (see `getPlannedBossMinutes`). */
  getMinutes: (phase: number) => number;
  phaseNames: readonly string[];
  units: readonly QueueUnit[];
}): QueueUnit[] {
  return units.flatMap((unit, index) => {
    const next = units[index + 1];

    if (next && next.phase === unit.phase) {
      return [unit];
    }

    const boss: QueueUnit = {
      area: unit.area,
      chapterId: null,
      key: getBossKey(unit.phase),
      kind: "boss",
      lessonId: null,
      minutes: getMinutes(unit.phase),
      phase: unit.phase,
      skillId: null,
      title: phaseNames[unit.phase] ?? "",
    };

    return [unit, boss];
  });
}

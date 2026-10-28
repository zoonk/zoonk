import { type QueueUnit, getBossKey } from "./plan-units";

export function addPhaseCheckpoints({
  getMinutes,
  phaseNames,
  units,
}: {
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

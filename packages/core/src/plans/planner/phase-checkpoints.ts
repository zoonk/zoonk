import { LEARN_KINDS } from "./plan-item-rules";
import { type ExistingPlanItem } from "./plan-items";
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

/**
 * A phase's challenge checks what the learner studies in it: a phase placement found known, or one
 * whose lessons their time leaves out entirely, has nothing for it to check.
 */
export function withoutUntaughtChallenges<Unit extends Pick<QueueUnit, "kind" | "phase">>({
  kept,
  landed,
  units,
}: {
  kept: readonly Pick<ExistingPlanItem, "kind" | "phase" | "status">[];
  landed: readonly Pick<QueueUnit, "kind" | "phase">[];
  units: readonly Unit[];
}): Unit[] {
  const taught = new Set([
    ...[...units, ...landed].flatMap((unit) => (unit.kind === "lesson" ? [unit.phase] : [])),
    ...kept.flatMap((item) =>
      LEARN_KINDS.has(item.kind) && (item.status === "todo" || item.status === "done")
        ? [item.phase]
        : [],
    ),
  ]);

  return units.filter((unit) => unit.kind !== "boss" || taught.has(unit.phase));
}

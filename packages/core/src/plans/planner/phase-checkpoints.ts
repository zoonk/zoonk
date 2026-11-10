import { getBossSkillIds } from "../../checkpoints/checkpoint-rules";
import { toBossPlan } from "./boss-plan";
import { listBossCandidates, projectBossPlan } from "./boss-projection";
import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { LEARN_KINDS } from "./plan-item-rules";
import { type ExistingPlanItem, type PlannedItem } from "./plan-items";
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
export function listTaughtPhases({
  kept,
  landed,
  units,
}: {
  kept: readonly Pick<ExistingPlanItem, "kind" | "phase" | "status">[];
  landed: readonly Pick<QueueUnit, "kind" | "phase">[];
  units: readonly Pick<QueueUnit, "kind" | "phase">[];
}): ReadonlySet<number> {
  return new Set([
    ...[...units, ...landed].flatMap((unit) => (unit.kind === "lesson" ? [unit.phase] : [])),
    ...kept.flatMap((item) =>
      LEARN_KINDS.has(item.kind) && (item.status === "todo" || item.status === "done")
        ? [item.phase]
        : [],
    ),
  ]);
}

export function listChallengesLeftOut({
  dropped,
  items,
  taught,
}: {
  dropped: readonly Pick<QueueUnit, "key" | "kind" | "phase">[];
  items: readonly Pick<PlannedItem, "key">[];
  taught: ReadonlySet<number>;
}): ReadonlySet<number> {
  const planned = new Set(items.map((item) => item.key));

  return new Set(
    dropped.flatMap((unit) =>
      unit.kind === "boss" && taught.has(unit.phase) && !planned.has(unit.key) ? [unit.phase] : [],
    ),
  );
}

export function withoutUntestableChallenges<Plan extends BuiltPlan>({
  built,
  input,
}: {
  built: Plan;
  input: BuildPlanInput;
}) {
  const facts = input.bossFacts;

  const plan = toBossPlan({
    input,
    items: built.items,
    phases: built.phases,
    rows: facts?.rows,
    skillLessons: built.skillLessons,
    survivors: facts?.survivors,
  });

  const missing = listBossCandidates({ built }).filter(
    (candidate) => !built.items.some((item) => item.key === candidate.key),
  );

  const projected =
    missing.length > 0
      ? projectBossPlan({
          built,
          candidates: missing,
          input,
          rows: facts?.rows,
          survivors: facts?.survivors,
        }).plan
      : plan;

  const missingKeys = new Set(missing.map((candidate) => candidate.key));

  const empty = new Set([
    ...plan.items
      .filter(
        (item) =>
          item.kind === "boss" &&
          item.status === "todo" &&
          getBossSkillIds({ ...plan, boss: item }).length === 0,
      )
      .map((item) => item.key),
    ...projected.items
      .filter(
        (item) =>
          missingKeys.has(item.key) && getBossSkillIds({ ...projected, boss: item }).length === 0,
      )
      .map((item) => item.key),
  ]);

  const items = built.items.filter((item) => !empty.has(item.key));

  const removedMinutes = built.items
    .filter((item) => empty.has(item.key))
    .reduce((sum, item) => sum + item.minutes, 0);

  return {
    ...built,
    estimate: {
      ...built.estimate,
      remainingMinutes: built.estimate.remainingMinutes - removedMinutes,
      totalMinutes: built.estimate.totalMinutes - removedMinutes,
    },
    items,
    phases: built.phases.map((phase, index) => ({
      ...phase,
      minutes:
        phase.minutes -
        built.items
          .filter((item) => item.phase === index && empty.has(item.key))
          .reduce((sum, item) => sum + item.minutes, 0),
      ...(empty.has(`boss:${index}`) && { challengeLeftOut: false }),
    })),
  };
}

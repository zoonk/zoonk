import { type PlanOperation } from "../../plan-contract";
import { type SimOperationSpec } from "./sim-life-plan";

/** A base choice's operations on the plan's bases now, or null when it has none. */
export function toOperations({
  listBases,
  spec,
}: {
  /** The plan's bases (`computePlan().bases.bases`). */
  listBases: () => readonly { skillId: string }[];
  spec: SimOperationSpec;
}): PlanOperation[] | null {
  const bases = listBases();
  const base = bases[spec.base % Math.max(1, bases.length)];

  return base
    ? [{ choices: [{ choice: spec.choice, skillId: base.skillId }], kind: "setBaseChoices" }]
    : null;
}

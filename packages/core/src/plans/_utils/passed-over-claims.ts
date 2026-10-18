import { type ClaimEvent } from "../../learner/_utils/skill-claims";
import { type PlanOperation } from "../plan-contract";
import { type PassedOver } from "../planner/graph-areas";

/** Whether an operation made the choice that passed a skill over. */
function makesChoice({ operation, passed }: { operation: PlanOperation; passed: PassedOver }) {
  if (operation.kind === "setBaseChoices") {
    return operation.choices.some(
      (entry) => entry.skillId === passed.skillId && entry.choice === "skip",
    );
  }

  return (
    operation.kind === "setAreaStart" &&
    operation.start === "pastBasics" &&
    operation.areas.includes(passed.area)
  );
}

/**
 * Each skill passed over by choice as a claim from the day of the choice: the latest applied change
 * that made it (`changes`, newest first), or the plan's first day (`createdAt`) for a choice made
 * while setting it up (see `loadPassedOverClaims`).
 */
export function toPassedOverClaims({
  changes,
  createdAt,
  passed,
}: {
  changes: readonly { at: Date; operations: readonly PlanOperation[] }[];
  createdAt: Date;
  passed: readonly PassedOver[];
}): ClaimEvent[] {
  return passed.map((entry) => ({
    at:
      changes.find((change) =>
        change.operations.some((operation) => makesChoice({ operation, passed: entry })),
      )?.at ?? createdAt,
    kind: "claim",
    skillId: entry.skillId,
  }));
}

import { type ClaimEvent } from "../../learner/_utils/skill-claims";
import { type PlanOperation } from "../plan-contract";
import { type PassedOver } from "../planner/graph-areas";

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

import { type PlanItem } from "@zoonk/db";
import { LEARN_KINDS } from "../../plans/planner/plan-item-rules";
import { type CheckpointKind } from "../../sessions/brain-power";

export type ChallengeReachItem = Pick<PlanItem, "kind" | "position" | "status"> & {
  id: string | null;
  key?: string;
};

export type BossTiming = "date" | "nextSession" | "queued";

export function isChallengeReached({
  boss,
  items,
  ahead = new Set(),
}: {
  boss: ChallengeReachItem;
  items: readonly ChallengeReachItem[];
  ahead?: ReadonlySet<string>;
}): boolean {
  return (
    boss.kind === "boss" &&
    boss.status === "todo" &&
    !items.some(
      (item) =>
        LEARN_KINDS.has(item.kind) &&
        item.status === "todo" &&
        item.position < boss.position &&
        !ahead.has(item.id ?? item.key ?? ""),
    )
  );
}

export function isPhaseChallenge(
  checkpoint: { kind: CheckpointKind; mock: boolean } | null,
): boolean {
  return checkpoint !== null && !checkpoint.mock && checkpoint.kind !== "weekly";
}

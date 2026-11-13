import { type ContentFixStatus } from "@zoonk/db";
import { Badge } from "@zoonk/ui/components/badge";

type ContentFixState = ContentFixStatus | "reverted";

type RevertRef = { id: string; status: ContentFixStatus };

export const contentFixStatusLabels: Record<ContentFixState, string> = {
  applied: "Applied",
  approved: "Approved, not applied yet",
  proposed: "Waiting for review",
  rejected: "Rejected",
  reverted: "Reverted",
  stale: "Stale",
};

const variants = {
  applied: "success",
  approved: "secondary",
  proposed: "default",
  rejected: "outline",
  reverted: "outline",
  stale: "destructive",
} as const satisfies Record<ContentFixState, string>;

/** The revert that put back what an applied fix replaced, if one applied. */
export function findAppliedRevert(fix: {
  revertedBy: readonly RevertRef[];
  status: ContentFixStatus;
}): RevertRef | null {
  return fix.status === "applied"
    ? (fix.revertedBy.find((revert) => revert.status === "applied") ?? null)
    : null;
}

export function contentFixState(fix: {
  revertedBy: readonly RevertRef[];
  status: ContentFixStatus;
}): ContentFixState {
  return findAppliedRevert(fix) ? "reverted" : fix.status;
}

export function ContentFixStatusBadge({ state }: { state: ContentFixState }) {
  return <Badge variant={variants[state]}>{contentFixStatusLabels[state]}</Badge>;
}

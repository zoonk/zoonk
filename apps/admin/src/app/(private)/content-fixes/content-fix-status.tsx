import { StateMark, type StateTone } from "@/components/state-mark";
import { type ContentFixStatus } from "@zoonk/db";

type ContentFixState = ContentFixStatus | "reverted";

type RevertRef = { id: string; status: ContentFixStatus };

export const contentFixStatusLabels: Record<ContentFixState, string> = {
  applied: "Applied",
  approved: "Approved, not applied yet",
  proposed: "Waiting for review",
  rejected: "Rejected",
  reverted: "Undone",
  stale: "Out of date",
  withdrawn: "Withdrawn",
};

/**
 * A fix that went stale changed nothing and needs proposing again, and one approved that didn't
 * finish applying needs its approver, so both read as ones to look at.
 */
export const contentFixStatusTones: Record<ContentFixState, StateTone> = {
  applied: "done",
  approved: "attention",
  proposed: "waiting",
  rejected: "off",
  reverted: "off",
  stale: "attention",
  withdrawn: "off",
};

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

export function ContentFixStatusMark({ state }: { state: ContentFixState }) {
  return (
    <StateMark state={state} tone={contentFixStatusTones[state]}>
      {contentFixStatusLabels[state]}
    </StateMark>
  );
}

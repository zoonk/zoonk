import { StateMark, type StateTone } from "@/components/state-mark";
import { contentFixStatusLabels as storedStatusLabels } from "@zoonk/core/staff/content-fixes/status-labels";
import { type ContentFixStatus } from "@zoonk/db";

type ContentFixState = ContentFixStatus | "reverted";

type RevertRef = { id: string; status: ContentFixStatus };

export const contentFixStatusLabels: Record<ContentFixState, string> = {
  ...storedStatusLabels,
  reverted: "Undone",
};

/** A fix that went stale changed nothing and needs proposing again, so it reads as one to look at. */
export const contentFixStatusTones: Record<ContentFixState, StateTone> = {
  applied: "done",
  approved: "going",
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

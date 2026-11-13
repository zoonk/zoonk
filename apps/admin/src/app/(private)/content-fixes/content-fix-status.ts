import { type StateTone } from "@/components/state-mark";
import { type ContentFixStatus } from "@zoonk/db";

export const contentFixStatusLabels: Record<ContentFixStatus, string> = {
  applied: "Applied",
  proposed: "Waiting for review",
  rejected: "Rejected",
  stale: "Out of date",
};

/** A fix that went stale changed nothing and needs proposing again, so it reads as one to look at. */
export const contentFixStatusTones: Record<ContentFixStatus, StateTone> = {
  applied: "done",
  proposed: "waiting",
  rejected: "off",
  stale: "attention",
};

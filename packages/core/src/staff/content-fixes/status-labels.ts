import { type ContentFixStatus } from "@zoonk/db";

/** What staff call each state, on Admin's review pages and in the CLI's messages alike. */
export const contentFixStatusLabels: Record<ContentFixStatus, string> = {
  applied: "Applied",
  approved: "Approved, not applied yet",
  proposed: "Waiting for review",
  rejected: "Rejected",
  stale: "Out of date",
  withdrawn: "Withdrawn",
};

import { type ContentFixStatus } from "@zoonk/db";
import { Badge } from "@zoonk/ui/components/badge";

export const contentFixStatusLabels: Record<ContentFixStatus, string> = {
  applied: "Applied",
  approved: "Approved, not applied yet",
  proposed: "Waiting for review",
  rejected: "Rejected",
  stale: "Stale",
};

const variants = {
  applied: "success",
  approved: "secondary",
  proposed: "default",
  rejected: "outline",
  stale: "destructive",
} as const satisfies Record<ContentFixStatus, string>;

export function ContentFixStatusBadge({ status }: { status: ContentFixStatus }) {
  return <Badge variant={variants[status]}>{contentFixStatusLabels[status]}</Badge>;
}

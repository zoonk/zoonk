import { type ContentFixStatus } from "@zoonk/db";
import { Badge } from "@zoonk/ui/components/badge";

export const contentFixStatusLabels: Record<ContentFixStatus, string> = {
  applied: "Applied",
  proposed: "Waiting for review",
  rejected: "Rejected",
  stale: "Stale",
};

const variants = {
  applied: "success",
  proposed: "default",
  rejected: "outline",
  stale: "destructive",
} as const satisfies Record<ContentFixStatus, string>;

export function ContentFixStatusBadge({ status }: { status: ContentFixStatus }) {
  return <Badge variant={variants[status]}>{contentFixStatusLabels[status]}</Badge>;
}

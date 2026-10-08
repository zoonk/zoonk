import { Badge } from "@zoonk/ui/components/badge";
import { type FeedbackStatus } from "@zoonk/db";
import { feedbackStatusLabels, getFeedbackStatusVariant } from "../_utils/feedback-labels";

export function MessageStatusBadge({ status }: { status: FeedbackStatus }) {
  return <Badge variant={getFeedbackStatusVariant(status)}>{feedbackStatusLabels[status]}</Badge>;
}

import { AdminNameCell } from "@/components/admin-name-cell";
import { AdminTableRow } from "@/components/admin-table-row";
import { StateMark } from "@/components/state-mark";
import { type ListedFeedbackMessage } from "@/data/feedback/list-feedback-messages";
import { formatDate } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";
import {
  feedbackStatusLabels,
  getFeedbackLearnerLabel,
  getFeedbackPlatform,
  getFeedbackSubject,
} from "../_utils/feedback-labels";

/** Who wrote: their name and the address a reply goes to. */
function sender({ email, user }: ListedFeedbackMessage): string {
  return (
    [user ? getFeedbackLearnerLabel(user) : null, email].filter(Boolean).join(" · ") ||
    "Unknown sender"
  );
}

/** A row leads with the message's own first line, so staff can pick what to open. */
export function MessageRow({
  message,
  showState,
}: {
  message: ListedFeedbackMessage;
  showState: boolean;
}) {
  const { context } = message;
  const subject = getFeedbackSubject(context);

  return (
    <AdminTableRow>
      <AdminNameCell
        href={`/feedback/messages/${message.id}`}
        note={sender(message)}
        title={<span className="line-clamp-1">{message.message}</span>}
      />
      {showState ? (
        <TableCell>
          <StateMark state={message.status}>{feedbackStatusLabels[message.status]}</StateMark>
        </TableCell>
      ) : null}
      <TableCell>
        <span className="text-foreground block truncate">{subject}</span>
        {context.screen && context.screen !== subject ? (
          <span className="block truncate text-xs">Sent from the {context.screen} screen</span>
        ) : null}
      </TableCell>
      <TableCell>{getFeedbackPlatform(context)}</TableCell>
      <TableCell>{formatDate(message.createdAt)}</TableCell>
    </AdminTableRow>
  );
}

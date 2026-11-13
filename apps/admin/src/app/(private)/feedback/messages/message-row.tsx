import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { type ListedFeedbackMessage } from "@/data/feedback/list-feedback-messages";
import { formatDate } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";
import {
  feedbackStatusLabels,
  getFeedbackLearnerLabel,
  getFeedbackPlatform,
  getFeedbackSubject,
} from "../_utils/feedback-labels";

/** Rows show who wrote and what about, never the message's text: that stays on its own page. */
export function MessageRow({
  message,
  showState,
}: {
  message: ListedFeedbackMessage;
  showState: boolean;
}) {
  const { context, email, user } = message;
  const subject = getFeedbackSubject(context);

  return (
    <AdminTableRow>
      <TableCell>
        <AdminTableRowLink className="block" href={`/feedback/messages/${message.id}`} prefetch>
          <span className="block truncate font-medium">
            {user ? getFeedbackLearnerLabel(user) : (email ?? "Unknown sender")}
          </span>
          {user ? (
            <span className="text-muted-foreground block truncate text-xs">
              {email ?? "No reply email"}
            </span>
          ) : null}
        </AdminTableRowLink>
      </TableCell>
      {showState ? (
        <TableCell className={message.status === "new" ? "font-medium" : "text-muted-foreground"}>
          {feedbackStatusLabels[message.status]}
        </TableCell>
      ) : null}
      <TableCell>
        <span className="block truncate">{subject}</span>
        {context.screen && context.screen !== subject ? (
          <span className="text-muted-foreground block truncate text-xs">
            Sent from the {context.screen} screen
          </span>
        ) : null}
      </TableCell>
      <TableCell className="text-muted-foreground">{getFeedbackPlatform(context) ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{formatDate(message.createdAt)}</TableCell>
    </AdminTableRow>
  );
}

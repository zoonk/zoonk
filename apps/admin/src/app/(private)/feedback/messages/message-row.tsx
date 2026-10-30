import { AdminTableRow, AdminTableRowLink } from "@/components/admin-table-row";
import { type ListedFeedbackMessage } from "@/data/feedback/list-feedback-messages";
import { formatDate } from "@/lib/format";
import { TableCell } from "@zoonk/ui/components/table";
import { feedbackContentKindLabels } from "../_utils/feedback-labels";
import { MessageSender } from "./message-sender";
import { MessageStatusBadge } from "./message-status-badge";

/** Rows show where a message came from, never its text: that stays on the detail page. */
export function MessageRow({ message }: { message: ListedFeedbackMessage }) {
  const { context } = message;

  return (
    <AdminTableRow>
      <TableCell>
        <AdminTableRowLink href={`/feedback/messages/${message.id}`} prefetch>
          {formatDate(message.createdAt)}
        </AdminTableRowLink>
      </TableCell>
      <TableCell>
        <MessageStatusBadge status={message.status} />
      </TableCell>
      <TableCell className="max-w-56">
        <MessageSender email={message.email} user={message.user} />
      </TableCell>
      <TableCell className="max-w-64 truncate text-xs">
        {context.screen ?? context.url ?? "—"}
      </TableCell>
      <TableCell className="text-xs">
        {[context.platform, context.appVersion].filter(Boolean).join(" · ") || "—"}
      </TableCell>
      <TableCell className="text-xs">
        {context.contentKind ? feedbackContentKindLabels[context.contentKind] : "—"}
      </TableCell>
    </AdminTableRow>
  );
}

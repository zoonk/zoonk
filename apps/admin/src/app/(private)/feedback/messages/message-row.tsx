import { type ListedFeedbackMessage } from "@/data/feedback/list-feedback-messages";
import { formatDate } from "@/lib/format";
import { TableCell, TableRow } from "@zoonk/ui/components/table";
import Link from "next/link";
import { feedbackContentKindLabels } from "../_utils/feedback-labels";
import { MessageSender } from "./message-sender";
import { MessageStatusBadge } from "./message-status-badge";

/** Rows show where a message came from, never its text: that stays on the detail page. */
export function MessageRow({ message }: { message: ListedFeedbackMessage }) {
  const { context } = message;

  return (
    <TableRow>
      <TableCell>
        <Link className="hover:underline" href={`/feedback/messages/${message.id}`} prefetch>
          {formatDate(message.createdAt)}
        </Link>
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
    </TableRow>
  );
}

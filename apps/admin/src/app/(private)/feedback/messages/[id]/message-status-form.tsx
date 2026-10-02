"use client";

import { AdminActionSubmitButton } from "@/components/admin-action-submit-button";
import { type FeedbackStatus } from "@zoonk/db";
import { MailIcon, MailOpenIcon, ReplyIcon } from "lucide-react";
import { useActionState } from "react";
import {
  type UpdateMessageStatusState,
  updateMessageStatusAction,
} from "./_actions/update-message-status";

const INITIAL_STATE: UpdateMessageStatusState = { error: null, status: "idle", submissionId: 0 };

const statusActions: { icon: React.ReactNode; label: string; status: FeedbackStatus }[] = [
  { icon: <MailOpenIcon />, label: "Mark as read", status: "read" },
  { icon: <ReplyIcon />, label: "Mark as replied", status: "replied" },
  { icon: <MailIcon />, label: "Mark as new", status: "new" },
];

/** Offers every status except the current one, so one click moves the message along. */
export function MessageStatusForm({
  currentStatus,
  messageId,
}: {
  currentStatus: FeedbackStatus;
  messageId: string;
}) {
  const [state, formAction] = useActionState(updateMessageStatusAction, INITIAL_STATE);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        {statusActions
          .filter((action) => action.status !== currentStatus)
          .map((action) => (
            <form action={formAction} key={action.status}>
              <input name="messageId" type="hidden" value={messageId} />
              <input name="status" type="hidden" value={action.status} />
              <AdminActionSubmitButton icon={action.icon}>{action.label}</AdminActionSubmitButton>
            </form>
          ))}
      </div>
      <span
        aria-live="polite"
        className="text-destructive text-right text-xs empty:hidden"
        key={state.submissionId}
      >
        {state.error}
      </span>
    </div>
  );
}

"use client";

import { type FeedbackStatus } from "@zoonk/db";
import { AdminBarMenu } from "@/components/admin-bar-buttons";
import { useAdminActionState } from "@/lib/use-admin-action-state";
import { Button } from "@zoonk/ui/components/button";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { CheckIcon, MailIcon, MailOpenIcon, ReplyIcon } from "lucide-react";
import { startTransition } from "react";
import {
  type UpdateMessageStatusState,
  updateMessageStatusAction,
} from "./_actions/update-message-status";

const INITIAL_STATE: UpdateMessageStatusState = { error: null, status: "idle", submissionId: 0 };

const STATUS_ACTIONS: Record<FeedbackStatus, { icon: React.ReactNode; label: string }> = {
  new: { icon: <MailIcon aria-hidden="true" />, label: "Mark as new" },
  read: { icon: <MailOpenIcon aria-hidden="true" />, label: "Mark as read" },
  replied: { icon: <CheckIcon aria-hidden="true" />, label: "Mark as replied" },
};

/**
 * Reply opens the staff person's own mail, so replying and marking it replied are two presses. The
 * step that takes a message out of New is a button; the other states are in the menu. On a phone
 * the bar has room for one short button beside the way back, so that step is the menu's first item
 * there and the button says "Reply".
 */
export function MessageActions({
  email,
  messageId,
  status,
}: {
  email: string | null;
  messageId: string;
  status: FeedbackStatus;
}) {
  const [, formAction] = useAdminActionState({
    action: updateMessageStatusAction,
    initialState: INITIAL_STATE,
  });

  const nextStatus: FeedbackStatus = email ? "replied" : "read";
  const closing = status === nextStatus || status === "replied" ? null : nextStatus;

  const menuStatuses = (["new", "read", "replied"] as const).filter(
    (option) => option !== status && option !== closing,
  );

  const setStatus = (next: FeedbackStatus) => {
    const formData = new FormData();
    formData.set("messageId", messageId);
    formData.set("status", next);
    startTransition(() => formAction(formData));
  };

  return (
    <>
      {email ? (
        <Button
          icon={<ReplyIcon aria-hidden="true" />}
          nativeButton={false}
          render={
            <a href={`mailto:${email}?subject=${encodeURIComponent("Your message to Zoonk")}`} />
          }
          size="bar"
        >
          Reply<span className="max-sm:hidden"> by email</span>
        </Button>
      ) : null}

      {closing ? (
        <form action={formAction} className="max-sm:hidden">
          <input name="messageId" type="hidden" value={messageId} />
          <input name="status" type="hidden" value={closing} />
          <Button icon={STATUS_ACTIONS[closing].icon} size="bar" type="submit" variant="outline">
            {STATUS_ACTIONS[closing].label}
          </Button>
        </form>
      ) : null}

      <AdminBarMenu label="Message actions">
        {closing ? (
          <DropdownMenuItem className="sm:hidden" onClick={() => setStatus(closing)}>
            {STATUS_ACTIONS[closing].icon}
            {STATUS_ACTIONS[closing].label}
          </DropdownMenuItem>
        ) : null}

        {menuStatuses.map((option) => (
          <DropdownMenuItem key={option} onClick={() => setStatus(option)}>
            {STATUS_ACTIONS[option].icon}
            {STATUS_ACTIONS[option].label}
          </DropdownMenuItem>
        ))}
      </AdminBarMenu>
    </>
  );
}

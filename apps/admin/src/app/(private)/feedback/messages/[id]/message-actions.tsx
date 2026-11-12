"use client";

import { type FeedbackStatus } from "@zoonk/db";
import { useAdminActionState } from "@/lib/use-admin-action-state";
import { Button } from "@zoonk/ui/components/button";
import { DetailMenu } from "@zoonk/ui/components/detail";
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
 * step that takes a message out of New is a button; the other states are in the menu.
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
  const [state, formAction] = useAdminActionState({
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
    <div className="flex flex-col gap-1 md:items-end">
      <div className="flex flex-wrap items-center gap-2">
        {email ? (
          <Button
            icon={<ReplyIcon aria-hidden="true" />}
            nativeButton={false}
            render={<a href={`mailto:${email}?subject=${encodeURIComponent("Your message to Zoonk")}`} />}
            size="lg"
          >
            Reply
          </Button>
        ) : null}

        {closing ? (
          <form action={formAction}>
            <input name="messageId" type="hidden" value={messageId} />
            <input name="status" type="hidden" value={closing} />
            <Button icon={STATUS_ACTIONS[closing].icon} size="lg" type="submit" variant="outline">
              {STATUS_ACTIONS[closing].label}
            </Button>
          </form>
        ) : null}

        <DetailMenu label="Message actions">
          {menuStatuses.map((option) => (
            <DropdownMenuItem key={option} onClick={() => setStatus(option)}>
              {STATUS_ACTIONS[option].icon}
              {STATUS_ACTIONS[option].label}
            </DropdownMenuItem>
          ))}
        </DetailMenu>
      </div>

      <span
        aria-live="polite"
        className="text-destructive-text text-xs empty:hidden md:text-right"
        key={state.submissionId}
      >
        {state.error}
      </span>
    </div>
  );
}

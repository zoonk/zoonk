import Link from "next/link";
import { getLearnerLabel } from "../_utils/feedback-labels";

type MessageSenderProps = {
  email: string | null;
  user: { email: string; id: string; name: string; username: string | null } | null;
};

/**
 * A signed-in sender links to their account. Visitors, and senders whose account was deleted, only
 * left the email they typed in the form.
 */
export function MessageSender({ email, user }: MessageSenderProps) {
  if (!user) {
    return <span className="text-sm">{email ?? "Unknown sender"}</span>;
  }

  return (
    <span className="flex flex-col">
      <Link className="truncate font-medium hover:underline" href={`/users/${user.id}`} prefetch>
        {getLearnerLabel(user)}
      </Link>
      <span className="text-muted-foreground truncate text-xs">{email ?? user.email}</span>
    </span>
  );
}

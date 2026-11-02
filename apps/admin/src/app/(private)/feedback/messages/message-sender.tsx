import Link from "next/link";
import { getLearnerLabel } from "../_utils/feedback-labels";

type MessageSenderProps = {
  email: string | null;
  user: { email: string; id: string; name: string; username: string | null } | null;
};

export function MessageSender({ email, user }: MessageSenderProps) {
  if (!user) {
    return <span className="text-sm">{email ?? "Unknown sender"}</span>;
  }

  return (
    <span className="flex flex-col">
      <Link className="font-medium hover:underline" href={`/users/${user.id}`} prefetch>
        <span className="block truncate">{getLearnerLabel(user)}</span>
      </Link>
      <span className="text-muted-foreground truncate text-xs">{email ?? user.email}</span>
    </span>
  );
}

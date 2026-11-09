import Link from "next/link";
import { getFeedbackLearnerLabel } from "../_utils/feedback-labels";

type MessageSenderProps = {
  email: string | null;
  user: {
    email: string;
    id: string;
    isAnonymous: boolean;
    name: string;
    username: string | null;
  } | null;
};

export function MessageSender({ email, user }: MessageSenderProps) {
  if (!user) {
    return <span className="text-sm">{email ?? "Unknown sender"}</span>;
  }

  return (
    <span className="flex flex-col">
      <Link className="font-medium hover:underline" href={`/users/${user.id}`} prefetch>
        <span className="block truncate">{getFeedbackLearnerLabel(user)}</span>
      </Link>
      <span className="text-muted-foreground truncate text-xs">{email ?? "No reply email"}</span>
    </span>
  );
}

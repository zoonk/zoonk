import { type InboxQueueName, getInbox } from "@/data/inbox/get-inbox";
import { SIDEBAR_COUNT_CLASS } from "@zoonk/ui/components/sidebar";

export async function InboxCount({ queue }: { queue: InboxQueueName }) {
  const inbox = await getInbox();
  const { count } = inbox[queue];

  if (count === 0) {
    return null;
  }

  return (
    <span className={SIDEBAR_COUNT_CLASS}>
      {count}
      <span className="sr-only"> waiting</span>
    </span>
  );
}

import { cookies } from "next/headers";
import { type InboxQueueName, getInbox } from "@/data/inbox/get-inbox";
import { SIDEBAR_COUNT_CLASS } from "@zoonk/ui/components/sidebar";

async function isClear() {
  // Review pack only: Home with nothing waiting.
  return (await cookies()).get("adm-clear")?.value === "1";
}

export async function InboxTotal() {
  const inbox = await getInbox();
  const total = Object.values(inbox).reduce((sum, queue) => sum + queue.count, 0);

  return (
    <span className={SIDEBAR_COUNT_CLASS}>
      {total}
      <span className="sr-only"> waiting</span>
    </span>
  );
}

export async function InboxCount({ queue }: { queue: InboxQueueName }) {
  if (await isClear()) {
    return null;
  }

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

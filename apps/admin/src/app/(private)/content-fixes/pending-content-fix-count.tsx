import { countPendingContentFixes } from "@/data/content-fixes/list-content-fixes";
import { SIDEBAR_COUNT_CLASS } from "@zoonk/ui/components/sidebar";

export async function PendingContentFixCount() {
  const pending = await countPendingContentFixes();

  if (pending === 0) {
    return null;
  }

  return (
    <span className={SIDEBAR_COUNT_CLASS}>
      {pending}
      <span className="sr-only"> waiting for review</span>
    </span>
  );
}

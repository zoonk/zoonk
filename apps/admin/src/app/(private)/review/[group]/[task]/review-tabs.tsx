import { countReviewStatuses } from "@/data/review/count-review-statuses";
import { type ReviewTaskType, getTaskPath } from "@/lib/review-utils";
import { cn } from "@zoonk/ui/lib/utils";
import Link from "next/link";

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-muted-foreground border-b-2 border-transparent px-1 pb-2 text-sm font-medium transition-colors",
        active && "text-foreground border-foreground",
        !active && "hover:text-foreground/80",
      )}
    >
      {children}
    </Link>
  );
}

export async function ReviewTabs({ taskType, view }: { taskType: ReviewTaskType; view?: string }) {
  const counts = await countReviewStatuses(taskType);
  const basePath = getTaskPath(taskType);
  const isFlagged = view === "flagged";

  return (
    <div className="flex gap-4 border-b">
      <TabLink href={basePath} active={!isFlagged}>
        Pending ({counts.pending})
      </TabLink>

      <TabLink href={`${basePath}?view=flagged`} active={isFlagged}>
        Needs changes ({counts.needsChanges})
      </TabLink>
    </div>
  );
}

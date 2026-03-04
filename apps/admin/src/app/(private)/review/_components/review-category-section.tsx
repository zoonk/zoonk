import { type ReviewTaskType, getTaskLabel, getTaskPath } from "@/lib/review-utils";
import { Badge } from "@zoonk/ui/components/badge";
import Link from "next/link";

export function ReviewCategorySection({
  label,
  tasks,
  counts,
}: {
  label: string;
  tasks: ReviewTaskType[];
  counts: Record<ReviewTaskType, number>;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-muted-foreground px-1 text-xs font-medium tracking-wider uppercase">
        {label}
      </h3>

      <div className="flex flex-col">
        {tasks.map((taskType) => (
          <Link
            key={taskType}
            href={getTaskPath(taskType)}
            className="hover:bg-muted/50 flex items-center justify-between rounded-md px-3 py-2.5 transition-colors"
          >
            <span className="text-sm">{getTaskLabel(taskType)}</span>
            {counts[taskType] > 0 && <Badge variant="secondary">{counts[taskType]}</Badge>}
          </Link>
        ))}
      </div>
    </div>
  );
}

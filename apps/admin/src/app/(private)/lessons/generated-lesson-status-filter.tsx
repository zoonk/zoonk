import { type GeneratedLessonStatus, generatedLessonStatuses } from "@/lib/generated-lesson-status";
import { Button } from "@zoonk/ui/components/button";
import Link from "next/link";

const statusLabels: Record<GeneratedLessonStatus, string> = {
  completed: "Completed",
  failed: "Failed",
};

type StatusQueryEntry = [string, string | undefined] | undefined;

/**
 * Generated lesson logs are easiest to scan when the terminal status is a
 * route-level filter. Links keep the page server-rendered and make filtered
 * states shareable during admin review.
 */
export function GeneratedLessonStatusFilter({
  search,
  status,
}: {
  search?: string;
  status: GeneratedLessonStatus;
}) {
  return (
    <nav aria-label="Generation status filter" className="flex flex-wrap gap-1">
      {generatedLessonStatuses.map((item) => (
        <Button
          key={item}
          nativeButton={false}
          render={
            <Link
              aria-current={status === item ? "page" : undefined}
              href={buildStatusHref({ search, status: item })}
              prefetch
            />
          }
          size="sm"
          variant={status === item ? "default" : "outline"}
        >
          {statusLabels[item]}
        </Button>
      ))}
    </nav>
  );
}

/**
 * Switching status should keep the current search term but reset pagination so
 * admins do not land on an empty page after changing result sets.
 */
function buildStatusHref({
  search,
  status,
}: {
  search?: string;
  status: GeneratedLessonStatus;
}): `/lessons?${string}` {
  const entries: StatusQueryEntry[] = [["status", status], search ? ["search", search] : undefined];

  const params = new URLSearchParams(entries.filter((entry) => isQueryEntry(entry)));

  return `/lessons?${params.toString()}`;
}

/**
 * URLSearchParams cannot consume conditional false entries, so this keeps the
 * query-building expression compact without weakening types.
 */
function isQueryEntry(entry: StatusQueryEntry): entry is [string, string] {
  return Array.isArray(entry) && Boolean(entry[1]);
}

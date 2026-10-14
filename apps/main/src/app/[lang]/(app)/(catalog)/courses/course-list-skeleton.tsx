import { COURSE_MARK_CLASS } from "@/components/catalog/course-mark";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { COURSE_LIST_CLASS } from "./course-list-styles";

const ROWS = 8;

/** The widths of the placeholder titles, so the rows don't read as one block. */
const TITLE_WIDTHS = ["w-2/5", "w-3/5", "w-1/2", "w-2/3"];

/**
 * The courses' list while it loads, in the list's own shape: rows on phones and tablets, cards
 * from `lg`, each with its mark's place, a title, two lines of description and its numbers.
 */
export function CourseListSkeleton() {
  return (
    <ul aria-hidden="true" className={COURSE_LIST_CLASS}>
      {Array.from({ length: ROWS }, (_, index) => (
        <li
          className="lg:bg-card lg:ring-border flex items-start gap-3 py-3 lg:flex-col lg:rounded-xl lg:p-4 lg:ring-1"
          // oxlint-disable-next-line react/no-array-index-key -- Placeholders are positions, not items.
          key={index}
        >
          <Skeleton className={COURSE_MARK_CLASS} />

          <span className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5 lg:w-full">
            <Skeleton className={cn("h-4", TITLE_WIDTHS[index % TITLE_WIDTHS.length])} />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="mt-0.5 h-3 w-32 lg:mt-2" />
          </span>
        </li>
      ))}
    </ul>
  );
}

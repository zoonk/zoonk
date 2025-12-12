import { CommandGroup } from "@zoonk/ui/components/command";
import { Skeleton } from "@zoonk/ui/components/skeleton";

type CommandPaletteResultsGroupProps = {
  heading: string;
  children: React.ReactNode;
};

/**
 * A wrapper around CommandGroup for search results.
 * Use this with `searchWithValidation` for consistent search result handling.
 */
export function CommandPaletteResultsGroup({
  heading,
  children,
}: CommandPaletteResultsGroupProps) {
  return <CommandGroup heading={heading}>{children}</CommandGroup>;
}

type CommandPaletteResultsSkeletonProps = {
  /**
   * Number of skeleton items to show.
   * @default 2
   */
  count?: number;
  /**
   * Whether to show an image placeholder.
   * @default true
   */
  showImage?: boolean;
};

/**
 * A generic skeleton for command palette search results.
 * Customize the number of items and whether to show image placeholders.
 */
export function CommandPaletteResultsSkeleton({
  count = 2,
  showImage = true,
}: CommandPaletteResultsSkeletonProps) {
  const safeCount = Number.isFinite(count) ? Math.max(0, count) : 0;

  return (
    <div className="flex flex-col gap-2 p-2">
      <Skeleton className="h-4 w-16" />
      {Array.from({ length: safeCount }).map((_, i) => (
        <div className="flex items-center gap-2" key={i}>
          {showImage && <Skeleton className="size-8" />}
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  );
}

type SearchResult<T> = { data: T[] | null; error: unknown };

/**
 * Helper function that handles common search validation and error handling.
 * Returns the data array if valid, or null if the query is empty, errored, or returned no results.
 *
 * @example
 * ```tsx
 * const courses = await searchWithValidation(query, () =>
 *   searchCourses({ orgSlug, title: query })
 * );
 *
 * if (!courses) return null;
 *
 * return courses.map(course => <Item key={course.id} />);
 * ```
 */
export async function searchWithValidation<T>(
  query: string,
  searchFn: () => Promise<SearchResult<T>>,
): Promise<T[] | null> {
  if (!query.trim()) {
    return null;
  }

  const { data, error } = await searchFn();

  if (error) {
    console.error("Search failed:", error);
    return null;
  }

  return data && data.length > 0 ? data : null;
}

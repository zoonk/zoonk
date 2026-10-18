import { PAGE_COLUMN_CLASS, PageTitle } from "@zoonk/learn/page";
import { PageWithAside } from "@zoonk/learn/shell";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";
import { JourneyPageBar } from "./journey-page-bar";

/** A list's rows while a page loads, when the page doesn't say how many it shows. */
const DEFAULT_ROWS = 5;

/**
 * The page's header while it loads, as `DetailHero` lays it out: what it belongs to, its name (the
 * page's own when it's always the same), its facts, and its main action with its "…".
 */
function HeroSkeleton({ title }: { title?: string }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-6">
      <div className="flex flex-col gap-1">
        <span className="flex h-4 items-center">
          <Skeleton className="h-3 w-36 rounded-sm" />
        </span>
        {title ? (
          <PageTitle>{title}</PageTitle>
        ) : (
          <Skeleton className="my-0.5 h-8 w-72 max-w-full rounded-md" />
        )}
        <span className="flex h-5 items-end">
          <Skeleton className="h-3 w-48 rounded-sm" />
        </span>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-11 flex-1 rounded-lg md:w-32 md:flex-none" />
        <Skeleton className="size-11 rounded-lg" />
      </div>
    </div>
  );
}

/**
 * The page's column while it loads: its bar, its header (with the tabs under it of a page that has
 * them, `tabs`) and a list's rows. A page whose name is always the same (the mistakes notebook)
 * shows it (`title`); what the page says about itself waits as bars.
 */
function DetailColumnSkeleton({
  bar,
  className,
  rows,
  tabs,
  title,
}: {
  bar: React.ReactNode;
  className?: string;
  rows: number;
  tabs: boolean;
  title?: string;
}) {
  return (
    <div aria-busy="true" className="flex flex-col gap-8">
      {bar}
      <div className={cn(PAGE_COLUMN_CLASS, "flex flex-col gap-8", className)}>
        <div className="flex flex-col gap-5">
          <HeroSkeleton title={title} />

          {tabs && (
            <div className="flex gap-1">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Skeleton className="h-3 w-24 rounded-sm" />
          {Array.from({ length: rows }, (_, index) => (
            <Skeleton className="h-11 w-full rounded-lg" key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A page opened from the Plan (a subject, a chapter, a unit, the exam, the mistakes notebook) while
 * it loads, in its own shape: its bar (back to the Plan, unless the page leads back elsewhere:
 * `bar`), its header with the main action beside the name from `md` (under it on a phone), its
 * tabs when it has them, a list's rows and, from 72rem, its aside's first block (a page without an
 * aside, such as the notebook's inbox, says so: `aside={false}`), so nothing moves when the page
 * arrives.
 */
export async function DetailSkeleton({
  aside = true,
  bar,
  className,
  rows = DEFAULT_ROWS,
  tabs = false,
  title,
}: {
  aside?: boolean;
  bar?: React.ReactNode;
  /** The column's own width, as the page's `DetailLayout` takes it (the notebook's inbox). */
  className?: string;
  rows?: number;
  tabs?: boolean;
  /** The page's name when it's always the same, in the very words the page shows. */
  title?: string;
}) {
  const column = (
    <DetailColumnSkeleton
      bar={bar ?? <JourneyPageBar />}
      className={className}
      rows={rows}
      tabs={tabs}
      title={title}
    />
  );

  if (!aside) {
    return column;
  }

  const t = await getExtracted();

  return (
    <PageWithAside
      aside={
        <div className="hidden flex-col gap-3 min-[72rem]:flex">
          <Skeleton className="h-3 w-20 rounded-sm" />
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton className="h-8.5 w-full rounded-md" key={index} />
          ))}
        </div>
      }
      asideLabel={t("Loading")}
    >
      {column}
    </PageWithAside>
  );
}

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
 * A list's rows while a page loads, flat as `ListGroup` draws them: a mark, a title over its line
 * and a trailing value, a hairline between rows.
 */
function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col [&>*+*]:border-t">
      {Array.from({ length: rows }, (_, index) => (
        <div className="flex h-15 items-center gap-3" key={index}>
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-3.5 w-48 max-w-2/3 rounded-sm" />
            <Skeleton className="h-3 w-28 max-w-1/2 rounded-sm" />
          </div>
          <Skeleton className="h-3 w-16 shrink-0 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

/** A section's label, in its header's height, while its page loads. */
export function SectionLabelSkeleton() {
  return (
    <span className="flex h-6 items-center">
      <Skeleton className="h-3 w-24 rounded-sm" />
    </span>
  );
}

/** A section of a list while its page loads: its label over its flat rows. */
export function ListSectionSkeleton({ rows = DEFAULT_ROWS }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <SectionLabelSkeleton />
      <RowsSkeleton rows={rows} />
    </div>
  );
}

/**
 * The page's column while it loads: its bar, its header (with the tabs under it of a page that has
 * them, `tabs`) and its sections (`children`). A page whose name is always the same (the
 * mistakes notebook) shows it (`title`); what the page says about itself waits as bars.
 */
function DetailColumnSkeleton({
  bar,
  children,
  className,
  tabs,
  title,
}: {
  bar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
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

        {children}
      </div>
    </div>
  );
}

/** An aside's first block while its page loads: its label over its properties. */
function AsideSkeleton() {
  return (
    <div className="hidden flex-col gap-3 min-[72rem]:flex">
      <Skeleton className="h-3 w-20 rounded-sm" />
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton className="h-8.5 w-full rounded-md" key={index} />
      ))}
    </div>
  );
}

/**
 * A page opened from the Plan (a subject, a chapter, a unit, the exam, the mistakes notebook) while
 * it loads, in its own shape: its bar (back to the Plan, unless the page leads back elsewhere:
 * `bar`), its header with the main action beside the name from `md` (under it on a phone), its
 * tabs when it has them, a list's flat rows (or the page's own sections, `children`) and, from
 * 72rem, its aside's first block (or the page's own, `aside`; a page without an aside, such as the
 * notebook's inbox, says so: `aside={false}`), so nothing moves when the page arrives.
 */
export async function DetailSkeleton({
  aside,
  bar,
  children,
  className,
  rows = DEFAULT_ROWS,
  tabs = false,
  title,
}: {
  /** The aside's blocks when they aren't one list of properties; `false` for a page without one. */
  aside?: React.ReactNode;
  bar?: React.ReactNode;
  /** The page's sections, when they're more than one list (`ListSectionSkeleton`). */
  children?: React.ReactNode;
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
      tabs={tabs}
      title={title}
    >
      {children ?? <ListSectionSkeleton rows={rows} />}
    </DetailColumnSkeleton>
  );

  if (aside === false) {
    return column;
  }

  const t = await getExtracted();

  return (
    <PageWithAside aside={aside ?? <AsideSkeleton />} asideLabel={t("Loading")}>
      {column}
    </PageWithAside>
  );
}

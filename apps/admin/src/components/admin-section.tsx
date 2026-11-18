import { FoldChevron } from "@zoonk/ui/components/collapsible";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { type Route } from "next";
import Link from "next/link";
import { DetailFieldsSkeleton } from "./detail-field";

export function AdminSection({
  action,
  children,
  description,
  title,
  titleClassName,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description?: React.ReactNode;
  title: React.ReactNode;
  titleClassName?: string;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3 [&>dl>div:first-child]:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className={cn("text-sm leading-5 font-semibold", titleClassName)}>{title}</h2>
          {description ? (
            <p className="text-muted-foreground text-compact text-pretty">{description}</p>
          ) : null}
        </div>
        {/* A 30 px control hangs past the 20 px title line, so the title and what follows it start
            at one height with or without one, as the section's skeleton draws them. */}
        {action ? <div className="-my-1.25 flex shrink-0 items-center">{action}</div> : null}
      </div>

      {children}
    </section>
  );
}

export function AdminSectionEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}

/** Under a list cut to its first rows: the link that shows the rest, or hides it again (`expanded`). */
export function AdminSectionMore({
  children,
  expanded = false,
  href,
}: {
  children: React.ReactNode;
  expanded?: boolean;
  href: Route;
}) {
  return (
    <Link
      aria-expanded={expanded}
      className="text-muted-foreground hover:text-foreground text-compact hit-area relative inline-flex items-center gap-1 self-start font-medium"
      href={href}
      prefetch
      scroll={false}
    >
      {children}
      <FoldChevron inline />
    </Link>
  );
}

const SKELETON_ROWS = 4;

export function AdminSectionSkeleton({
  children,
  description = false,
  rows = SKELETON_ROWS,
}: {
  children?: React.ReactNode;
  description?: boolean;
  rows?: number;
}) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <span className="flex flex-col gap-0.5">
        <span className="flex h-5 items-center">
          <Skeleton className="h-3.5 w-24" />
        </span>
        {description && (
          <span className="flex h-5 items-center">
            <Skeleton className="h-3 w-64 max-w-full" />
          </span>
        )}
      </span>
      {children ?? <DetailFieldsSkeleton rows={rows} />}
    </div>
  );
}

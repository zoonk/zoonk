import { Skeleton } from "@zoonk/ui/components/skeleton";
import { DetailFieldsSkeleton } from "./detail-field";

export function AdminSection({
  action,
  children,
  description,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description?: React.ReactNode;
  title: string;
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-sm leading-5 font-semibold">{title}</h2>
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

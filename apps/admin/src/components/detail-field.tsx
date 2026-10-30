import { Skeleton } from "@zoonk/ui/components/skeleton";

const FIELD_ROW_CLASS =
  "grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-x-4 py-2 text-sm sm:grid-cols-[11rem_minmax(0,1fr)]";

export function DetailFields({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y">{children}</dl>;
}

export function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={FIELD_ROW_CLASS}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="[&_a]:hit-area min-w-0 wrap-break-word [&_a]:relative">{children}</dd>
    </div>
  );
}

export function DetailFieldsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-y">
      {Array.from({ length: rows }, (_, index) => (
        <div className={FIELD_ROW_CLASS} key={index}>
          <span className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-20" />
          </span>
          <span className="flex h-5 items-center">
            <Skeleton className="h-3.5 w-40 max-w-full" />
          </span>
        </div>
      ))}
    </div>
  );
}

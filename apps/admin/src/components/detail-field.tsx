import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

const FIELD_ROW_CLASS =
  "grid grid-cols-[8rem_minmax(0,1fr)] items-baseline gap-x-4 py-3 text-sm @lg:grid-cols-[11rem_minmax(0,1fr)]";

export function DetailFields({ children }: { children: React.ReactNode }) {
  return <dl className="@container divide-y">{children}</dl>;
}

/** `mono` is for a value that is data, not words: a count, an amount, an id or a hash. */
export function DetailField({
  children,
  label,
  mono,
}: {
  children: React.ReactNode;
  label: string;
  mono?: boolean;
}) {
  return (
    <div className={FIELD_ROW_CLASS}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "[&_a]:hit-area min-w-0 wrap-break-word [&_a]:relative",
          mono && "text-compact font-mono tabular-nums",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

export function DetailFieldsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="@container divide-y">
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

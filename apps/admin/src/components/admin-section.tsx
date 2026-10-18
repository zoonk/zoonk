import { Separator } from "@zoonk/ui/components/separator";
import { Skeleton } from "@zoonk/ui/components/skeleton";

/**
 * Detail pages stack titled sections: a small heading with an optional action,
 * a rule, then the section's fields or table. One component keeps every
 * detail page on the same rhythm.
 */
export function AdminSection({
  action,
  children,
  description,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="flex flex-col">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
        </div>
        {action}
      </div>

      <Separator />

      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Empty sections say so in one quiet line instead of rendering an empty table. */
export function AdminSectionEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}

/** Placeholder for one streamed detail section. */
export function AdminSectionSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}

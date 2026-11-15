import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

export function Stat({ className, render, ...props }: useRender.ComponentProps<"div">) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(
          "ring-border flex min-w-0 flex-col gap-1.5 rounded-xl p-3 text-left ring-1 ring-inset",
          className,
        ),
      },
      props,
    ),
    render,
    state: { slot: "stat" },
  });
}

export function StatLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-label flex min-w-0 items-center gap-1.5", className)}
      data-slot="stat-label"
      {...props}
    />
  );
}

export function StatIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 [&>svg]:size-3.5", className)}
      data-slot="stat-icon"
      {...props}
    />
  );
}

export function StatValue({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "text-readout text-2xl leading-none [text-box:trim-end_cap_alphabetic]",
        className,
      )}
      data-slot="stat-value"
      {...props}
    />
  );
}

export function StatDetail({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground text-2xs leading-snug", className)}
      data-slot="stat-detail"
      {...props}
    />
  );
}

/**
 * A stat's own parts around a blank line each, so a placeholder takes the stat's loaded height.
 * `children` adds what a stat draws under its detail, such as a chart's room.
 */
export function StatSkeleton({
  children,
  detailLines = 0,
}: {
  children?: React.ReactNode;
  /** How many lines the stat's detail takes under its number. */
  detailLines?: number;
}) {
  return (
    <Stat aria-hidden="true">
      <StatLabel>
        <Skeleton className="w-20 rounded-sm">{"\u00A0"}</Skeleton>
      </StatLabel>
      <StatValue>
        <Skeleton className="w-14 rounded-sm">{"\u00A0"}</Skeleton>
      </StatValue>
      {detailLines > 0 && (
        <StatDetail className="flex flex-col">
          {Array.from({ length: detailLines }, (_, index) => (
            // oxlint-disable-next-line react/no-array-index-key -- Static placeholders.
            <Skeleton className="w-28 max-w-full rounded-sm" key={index}>
              {"\u00A0"}
            </Skeleton>
          ))}
        </StatDetail>
      )}
      {children}
    </Stat>
  );
}

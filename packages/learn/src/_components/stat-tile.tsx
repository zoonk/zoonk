import { cn } from "@zoonk/ui/lib/utils";

/** A number over its label in a soft box: a plan's estimate, a session's totals, a month's words. */
export function StatTile({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-muted in-data-[mode=fun]:fun-glass flex flex-col items-center gap-0.5 rounded-2xl px-2 py-3 text-center",
        className,
      )}
      data-slot="stat-tile"
      {...props}
    />
  );
}

export function StatTileValue({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "in-data-[mode=fun]:font-fun-display flex items-center gap-1 text-lg font-semibold tabular-nums",
        className,
      )}
      data-slot="stat-tile-value"
      {...props}
    />
  );
}

export function StatTileLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground in-data-[mode=fun]:text-fun-fg2 text-xs", className)}
      data-slot="stat-tile-label"
      {...props}
    />
  );
}

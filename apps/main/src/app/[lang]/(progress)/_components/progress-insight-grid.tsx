import { cn } from "@zoonk/ui/lib/utils";

/**
 * Keeps paired progress insights and their skeletons on the same responsive
 * grid so each metric page does not need to reproduce the layout contract.
 */
export function ProgressInsightGrid({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}
      data-slot="progress-insight-grid"
      {...props}
    >
      {children}
    </div>
  );
}

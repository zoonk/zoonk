import { cn } from "@zoonk/ui/lib/utils";
import { type ComponentProps } from "react";

export function ChartTooltipContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-popover text-popover-foreground ring-border flex flex-col gap-0.5 rounded-md px-3 py-2 shadow-md ring-1",
        className,
      )}
      data-slot="chart-tooltip-content"
      {...props}
    />
  );
}

export function ChartTooltipLabel({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground font-mono text-xs whitespace-nowrap first-letter:uppercase",
        className,
      )}
      data-slot="chart-tooltip-label"
      {...props}
    />
  );
}

export function ChartTooltipValue({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("font-mono text-sm font-medium whitespace-nowrap tabular-nums", className)}
      data-slot="chart-tooltip-value"
      {...props}
    />
  );
}

export function ChartTooltipNote({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground max-w-56 text-xs text-pretty", className)}
      data-slot="chart-tooltip-note"
      {...props}
    />
  );
}

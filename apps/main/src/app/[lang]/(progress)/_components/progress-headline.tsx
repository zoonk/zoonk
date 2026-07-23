import { cn } from "@zoonk/ui/lib/utils";

/**
 * Groups the primary progress metric with its contextual label and optional
 * comparison while keeping the headline hierarchy consistent across pages.
 */
export function ProgressHeadline({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-1", className)} data-slot="progress-headline" {...props}>
      {children}
    </div>
  );
}

/**
 * Presents the date range or metric name above a progress headline without
 * coupling the shared primitive to translated product copy.
 */
export function ProgressHeadlineLabel({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="progress-headline-label"
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Aligns the primary value with optional units or period comparisons on their
 * text baseline while allowing callers to compose either element freely.
 */
export function ProgressHeadlineRow({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-baseline gap-3", className)}
      data-slot="progress-headline-row"
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Owns the large, tabular typography used for each page's primary progress
 * value while semantic color remains a caller-owned class.
 */
export function ProgressHeadlineValue({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-5xl font-bold tracking-tight tabular-nums", className)}
      data-slot="progress-headline-value"
      {...props}
    >
      {children}
    </span>
  );
}

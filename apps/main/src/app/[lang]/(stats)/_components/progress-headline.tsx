import { cn } from "@zoonk/ui/lib/utils";

/**
 * Groups the primary progress metric with its contextual label and supporting
 * detail while keeping the headline hierarchy consistent across pages.
 */
export function ProgressHeadline({ children, className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-1", className)} data-slot="progress-headline" {...props}>
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
      className={cn("text-6xl font-bold tracking-tight wrap-break-word tabular-nums", className)}
      data-slot="progress-headline-value"
      {...props}
    >
      {children}
    </span>
  );
}

import { cn } from "@zoonk/ui/lib/utils";

/**
 * A compact pill container with a subtle pulse animation on value change.
 *
 * The pill owns only the shell and animation. Text pieces live in compound
 * children below so metric/status pills keep one typography contract instead
 * of duplicating label and value spans across each caller.
 */
export function StatusPill({
  animationKey,
  children,
  className,
}: {
  animationKey: string | number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      key={animationKey}
      className={cn(
        "animate-pulse-scale bg-muted/50 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 motion-reduce:animate-none",
        className,
      )}
      data-slot="status-pill"
    >
      {children}
    </span>
  );
}

/**
 * Shared muted label text for compact status pills.
 *
 * Keeping labels here prevents story metrics, feedback deltas, and progress
 * indicators from each choosing slightly different muted text treatments.
 */
export function StatusPillLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("text-muted-foreground text-xs", className)} data-slot="status-pill-label">
      {children}
    </span>
  );
}

/**
 * Shared value text for compact status pills.
 *
 * Values should read as the changing part of the pill, so this component owns
 * the stronger weight, tabular numbers, and transition used by all metric-like
 * pills.
 */
export function StatusPillValue({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn("text-xs font-semibold tabular-nums transition-colors duration-500", className)}
      data-slot="status-pill-value"
    >
      {children}
    </span>
  );
}

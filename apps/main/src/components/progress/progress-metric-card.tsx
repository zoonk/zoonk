import {
  FeatureCard,
  FeatureCardIcon,
  FeatureCardLabel,
  FeatureCardSubtitle,
  FeatureCardTitle,
} from "@zoonk/ui/components/feature";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * Owns the shared summary-card layout while domain adapters provide their own
 * icon, translated label, formatted value, and optional supporting content.
 */
export function ProgressMetricCard({
  children,
  className,
  ...props
}: React.ComponentProps<typeof FeatureCard>) {
  return (
    <FeatureCard
      className={cn(
        "text-muted-foreground grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 gap-y-0",
        className,
      )}
      data-slot="progress-metric-card"
      {...props}
    >
      {children}
    </FeatureCard>
  );
}

/** Positions a caller-owned metric icon at the start of the card header row. */
export function ProgressMetricCardIcon({
  children,
  className,
  ...props
}: React.ComponentProps<typeof FeatureCardIcon>) {
  return (
    <FeatureCardIcon
      className={cn("col-start-1 row-start-1", className)}
      data-slot="progress-metric-card-icon"
      {...props}
    >
      {children}
    </FeatureCardIcon>
  );
}

/**
 * Keeps the translated metric name beside its icon while allowing the label to
 * provide the card's accessible name through a caller-owned id.
 */
export function ProgressMetricCardLabel({
  children,
  className,
  ...props
}: React.ComponentProps<typeof FeatureCardLabel>) {
  return (
    <FeatureCardLabel
      className={cn("col-start-2 row-start-1", className)}
      data-slot="progress-metric-card-label"
      {...props}
    >
      {children}
    </FeatureCardLabel>
  );
}

/**
 * Aligns an optional caller-owned action or navigation indicator at the end of
 * the header without making the card depend on one interaction.
 */
export function ProgressMetricCardTrailing({
  children,
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("col-start-3 row-start-1 flex", className)}
      data-slot="progress-metric-card-trailing"
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Places the formatted metric on its own row while reusing FeatureCard's
 * established title typography and truncation behavior.
 */
export function ProgressMetricCardValue({
  children,
  className,
  ...props
}: React.ComponentProps<typeof FeatureCardTitle>) {
  return (
    <FeatureCardTitle
      className={cn("col-span-3 col-start-1 row-start-2 mt-2", className)}
      data-slot="progress-metric-card-value"
      {...props}
    >
      {children}
    </FeatureCardTitle>
  );
}

/**
 * Places optional caller-owned context directly below the formatted value
 * while reusing FeatureCard's supporting-text treatment.
 */
export function ProgressMetricCardSubtitle({
  children,
  className,
  ...props
}: React.ComponentProps<typeof FeatureCardSubtitle>) {
  return (
    <FeatureCardSubtitle
      className={cn("col-span-3 col-start-1 row-start-3 mt-0.5", className)}
      data-slot="progress-metric-card-subtitle"
      {...props}
    >
      {children}
    </FeatureCardSubtitle>
  );
}

/** Reserves the shared header row while a metric card's content streams. */
export function ProgressMetricCardLabelSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton
      className={cn("col-span-3 col-start-1 row-start-1 h-5", className)}
      data-slot="progress-metric-card-label-skeleton"
      {...props}
    />
  );
}

/** Reserves the shared value row while a metric card's content streams. */
export function ProgressMetricCardValueSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton
      className={cn("col-span-3 col-start-1 row-start-2 mt-2 h-4 w-full", className)}
      data-slot="progress-metric-card-value-skeleton"
      {...props}
    />
  );
}

/** Reserves the shared supporting-text row while a metric card's content streams. */
export function ProgressMetricCardSubtitleSkeleton({
  className,
  ...props
}: React.ComponentProps<typeof Skeleton>) {
  return (
    <Skeleton
      className={cn("col-span-3 col-start-1 row-start-3 mt-0.5 h-3 w-full", className)}
      data-slot="progress-metric-card-subtitle-skeleton"
      {...props}
    />
  );
}

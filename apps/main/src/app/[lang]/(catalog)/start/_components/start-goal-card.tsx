import { type AppRoute, Link } from "@/i18n/navigation";
import { Badge } from "@zoonk/ui/components/badge";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRightIcon } from "lucide-react";

/**
 * Keeps the goal-card collection semantic while letting each card remain a
 * normal link with its own accessible name and browser navigation behavior.
 */
export function StartGoalGrid({ children, className }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("grid w-full grid-cols-1 gap-3 md:grid-cols-3", className)}
      data-slot="start-goal-grid"
      role="list"
    >
      {children}
    </div>
  );
}

/**
 * Separates list semantics from the clickable card so the whole visual card can
 * be the link without forcing a non-link wrapper to handle interaction.
 */
export function StartGoalCardItem({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex min-w-0", className)} data-slot="start-goal-card-item" role="listitem">
      {children}
    </div>
  );
}

/**
 * Provides the shared clickable surface for start goals. It intentionally uses
 * subtle borders, small lift, and focus rings so keyboard and pointer feedback
 * feel responsive without turning the picker into a heavy card grid.
 */
export function StartGoalCard<Href extends string>({
  children,
  className,
  href,
}: {
  children: React.ReactNode;
  className?: string;
  href: AppRoute<Href>;
}) {
  return (
    <Link
      className={cn(
        "group/start-goal-card border-border/50 bg-background hover:border-foreground/20 hover:bg-muted/20 focus-visible:border-ring focus-visible:ring-ring/40 flex min-h-48 w-full flex-col justify-between rounded-lg border p-5 text-left transition-all duration-150 outline-none hover:-translate-y-0.5 focus-visible:ring-[3px]",
        className,
      )}
      data-slot="start-goal-card"
      href={href}
      prefetch
    >
      {children}
    </Link>
  );
}

/**
 * Gives each goal a stable visual anchor while keeping color muted enough that
 * the title remains the primary scanning target.
 */
export function StartGoalCardIcon({ children, className }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-muted/70 text-foreground group-hover/start-goal-card:bg-muted flex size-11 items-center justify-center rounded-lg transition-colors",
        className,
      )}
      data-slot="start-goal-card-icon"
    >
      {children}
    </div>
  );
}

/**
 * Reserves the top row for the icon and optional state badge, which keeps the
 * three goal cards aligned even when only one option is marked as upcoming.
 */
export function StartGoalCardHeader({ children, className }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-start justify-between gap-3", className)}
      data-slot="start-goal-card-header"
    >
      {children}
    </div>
  );
}

/**
 * Groups the card copy so titles and descriptions keep the same vertical rhythm
 * across the home placement and the standalone start page.
 */
export function StartGoalCardContent({ children, className }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-2 pt-6", className)} data-slot="start-goal-card-content">
      {children}
    </div>
  );
}

/**
 * Keeps goal titles compact because the card itself is a choice, not a page
 * section, and oversized type would make the picker harder to scan.
 */
export function StartGoalCardTitle({ children, className }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn("text-base leading-tight font-semibold text-balance", className)}
      data-slot="start-goal-card-title"
    >
      {children}
    </h2>
  );
}

/**
 * Provides one short reason to choose a goal while clamping long translations so
 * the cards keep their shared height on narrow screens.
 */
export function StartGoalCardDescription({ children, className }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground line-clamp-3 text-sm leading-relaxed", className)}
      data-slot="start-goal-card-description"
    >
      {children}
    </p>
  );
}

/**
 * Uses the shared badge styling for future availability labels instead of
 * inventing a start-page-only pill treatment.
 */
export function StartGoalCardBadge({ children, className }: React.ComponentProps<"span">) {
  return (
    <Badge className={className} data-slot="start-goal-card-badge" variant="secondary">
      {children}
    </Badge>
  );
}

/**
 * Shows that each card is actionable without requiring button chrome inside the
 * link, which keeps the whole card as the single hit target.
 */
export function StartGoalCardIndicator({ className }: { className?: string }) {
  return (
    <ArrowRightIcon
      aria-hidden="true"
      className={cn(
        "text-muted-foreground/50 mt-4 size-4 transition-transform group-hover/start-goal-card:translate-x-0.5",
        className,
      )}
      data-slot="start-goal-card-indicator"
    />
  );
}

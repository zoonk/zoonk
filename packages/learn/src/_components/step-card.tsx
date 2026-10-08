import { cn } from "@zoonk/ui/lib/utils";

/** The title the `Steps` frame moves focus to as each step comes. */
export const STEP_TITLE_SLOT = "step-title";

/**
 * One step's surface: its anchor (art, a kind tile or a big number) first, then its title and what
 * supports it, centered as one group.
 */
export function StepCard({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "bg-card flex flex-col items-center gap-5 rounded-3xl border px-6 py-8 text-center shadow-xs sm:px-8",
        className,
      )}
      data-slot="step-card"
      {...props}
    />
  );
}

/** The step's title with its quiet lines above (`StepEyebrow`) and under it (`StepDetail`). */
export function StepHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col items-center gap-1.5", className)}
      data-slot="step-header"
      {...props}
    />
  );
}

export function StepEyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-sm font-medium text-balance", className)}
      data-slot="step-eyebrow"
      {...props}
    />
  );
}

/** The step's one main thing, as the page's heading. The frame focuses it when the step comes. */
export function StepTitle({ children, className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn(
        "text-3xl font-bold tracking-tight text-balance outline-none sm:text-4xl",
        className,
      )}
      data-slot={STEP_TITLE_SLOT}
      tabIndex={-1}
      {...props}
    >
      {children}
    </h1>
  );
}

/**
 * A title led by a number ("300–470", "29% → 33%") with a quiet line that names it, above or under
 * the number: `StepTitleNumber` and `StepTitleLabel` inside `StepTitle className="flex flex-col"`.
 */
export function StepTitleNumber({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-5xl tabular-nums", className)}
      data-slot="step-title-number"
      {...props}
    />
  );
}

/** The words that name a title's number; spaced from it, so it reads as one heading. */
export function StepTitleLabel({ children, className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("text-muted-foreground text-sm font-medium tracking-normal", className)}
      data-slot="step-title-label"
      {...props}
    >
      {" "}
      {children}{" "}
    </span>
  );
}

export function StepDetail({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("text-muted-foreground text-balance", className)}
      data-slot="step-detail"
      {...props}
    />
  );
}

/** A few facts of the same kind, one per row, on a soft panel inside the card. */
export function StepRows({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("bg-muted/50 flex w-full flex-col rounded-2xl px-4 text-left", className)}
      data-slot="step-rows"
      {...props}
    />
  );
}

/** One row: an icon or a tile, its words, and what it's worth at the end. */
export function StepRow({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      className={cn(
        "border-border flex min-h-12 items-center gap-3 border-b py-3 text-sm last:border-b-0 [&>svg]:size-4 [&>svg]:shrink-0",
        className,
      )}
      data-slot="step-row"
      {...props}
    />
  );
}

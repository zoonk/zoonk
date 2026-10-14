import { cn } from "@zoonk/ui/lib/utils";

/** The title the `Steps` frame moves focus to as each step comes. */
export const STEP_TITLE_SLOT = "step-title";

/**
 * One step of a result told in steps, straight on the page (no card around it): its anchor (art
 * or a big number) when it has one, then its title and what supports it, left-aligned to the
 * task's column like every other page.
 */
export function StepCard({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn("flex flex-col items-start gap-5 text-left", className)}
      data-slot="step-card"
      {...props}
    />
  );
}

/** The step's title with its quiet lines above (`StepEyebrow`) and under it (`StepDetail`). */
export function StepHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col items-start gap-1.5", className)}
      data-slot="step-header"
      {...props}
    />
  );
}

/** The quiet label above the title ("TODAY'S SESSION"), in the section-label face. */
export function StepEyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p className={cn("text-label text-balance", className)} data-slot="step-eyebrow" {...props} />
  );
}

/** The step's one main thing, as the page's heading. The frame focuses it when the step comes. */
export function StepTitle({ children, className, ...props }: React.ComponentProps<"h1">) {
  return (
    <h1
      className={cn("text-title outline-none", className)}
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
      className={cn("font-mono text-5xl font-medium tracking-[-0.04em] tabular-nums", className)}
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

/** A few facts of the same kind, one per row, as a flat list with hairlines between the rows. */
export function StepRows({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex w-full flex-col text-left", className)}
      data-slot="step-rows"
      {...props}
    />
  );
}

/** One row: a muted icon or a dot, its words, and what it's worth at the end (mono). */
export function StepRow({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      className={cn(
        "border-border [&>svg]:text-muted-foreground flex min-h-11 items-center gap-3 border-b py-2.75 text-sm last:border-b-0 [&>svg]:size-4 [&>svg]:shrink-0",
        className,
      )}
      data-slot="step-row"
      {...props}
    />
  );
}

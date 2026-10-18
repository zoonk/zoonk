import { cn } from "@zoonk/ui/lib/utils";
import { EYEBROW_CLASS, LEAD_CLASS, STOP_TITLE_CLASS } from "./landing-styles";

/*
 * A stop on the landing's story, from Day 1 to the big day: an eyebrow with the app's own mark for
 * that moment, one short heading, one lead line, then one product moment. Inside `StopRail`, the
 * marks hang on one line in the left margin once there's room for it.
 *
 * ```tsx
 * <Stop aria-labelledby="stop-day-one">
 *   <StopHeader>
 *     <StopEyebrow>
 *       <StopMark><KindDot kind="lesson" /></StopMark>
 *       Day 1 · 2 minutes
 *     </StopEyebrow>
 *     <StopTitle id="stop-day-one">Your plan starts where you are.</StopTitle>
 *     <StopLead>A few quick questions find what you already know.</StopLead>
 *   </StopHeader>
 *   <StopBody>…</StopBody>
 * </Stop>
 * ```
 */

/** Where the rail runs, and its marks: from 88rem, where the margin has room for them. */
const RAIL_LINE_CLASS =
  "min-[88rem]:before:bg-border min-[88rem]:before:absolute min-[88rem]:before:inset-y-0 min-[88rem]:before:-left-11 min-[88rem]:before:w-px";

export function Stop({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "relative flex min-w-0 flex-col pt-26 lg:pt-38",
        RAIL_LINE_CLASS,
        // The rail starts at the first stop's mark and fades out under the last.
        "min-[88rem]:first:before:top-[calc(var(--spacing)*38+0.5rem)]",
        "min-[88rem]:last:before:from-border min-[88rem]:last:before:bg-transparent min-[88rem]:last:before:bg-linear-to-b min-[88rem]:last:before:from-85% min-[88rem]:last:before:to-transparent",
        className,
      )}
      data-slot="stop"
      {...props}
    />
  );
}

export function StopHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-4", className)} data-slot="stop-header" {...props} />
  );
}

export function StopEyebrow({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("relative flex items-center gap-2.5", EYEBROW_CLASS, className)}
      data-slot="stop-eyebrow"
      {...props}
    />
  );
}

/**
 * The stop's mark, the app's own for that moment (a kind's dot, the fast-forward of what's skipped,
 * Zu's face, the flag), beside the eyebrow; on the rail from 88rem. Decorative: the eyebrow says it.
 */
export function StopMark({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-foreground flex size-4 shrink-0 items-center justify-center",
        "min-[88rem]:bg-background min-[88rem]:ring-background min-[88rem]:absolute min-[88rem]:-left-13 min-[88rem]:rounded-full min-[88rem]:ring-6",
        className,
      )}
      data-slot="stop-mark"
      {...props}
    />
  );
}

export function StopTitle({ children, className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2 className={cn(STOP_TITLE_CLASS, className)} data-slot="stop-title" {...props}>
      {children}
    </h2>
  );
}

export function StopLead({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn(LEAD_CLASS, "-mt-1", className)} data-slot="stop-lead" {...props} />;
}

export function StopBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div className={cn("mt-9 min-w-0 lg:mt-11", className)} data-slot="stop-body" {...props} />
  );
}

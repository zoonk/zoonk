import { cn } from "@zoonk/ui/lib/utils";
import {
  EYEBROW_CLASS,
  LEAD_CLASS,
  PUBLIC_BAND_CLASS,
  PUBLIC_CONTAINER_CLASS,
  STOP_TITLE_CLASS,
} from "./landing-styles";

/*
 * A stop on a public page's story, from Day 1 to the big day: a band across the page (on `ground`
 * with `band`, so neighbors alternate), and in the page's container an eyebrow with the app's own
 * mark for that moment, one short heading, one lead line, then one product moment. Stops follow
 * each other, and their marks hang on one line in the left margin once there's room for it.
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

/**
 * Where the rail runs, and its marks: from 88rem, where the margin has room for them, 44px left of
 * the container's content (`PUBLIC_CONTAINER_CLASS`: 84rem with 2rem gutters), through each stop's
 * band, so the stops' lines meet.
 */
const RAIL_LINE_CLASS =
  "min-[88rem]:before:bg-border min-[88rem]:before:absolute min-[88rem]:before:inset-y-0 min-[88rem]:before:left-[calc((100%-84rem)/2-0.75rem)] min-[88rem]:before:w-px";

export function Stop({
  band = false,
  children,
  className,
  ...props
}: React.ComponentProps<"section"> & { band?: boolean }) {
  return (
    <section
      className={cn(
        "relative [--stop-surface:var(--background)]",
        band && "bg-ground [--stop-surface:var(--ground)]",
        RAIL_LINE_CLASS,
        // The rail starts at the first stop's mark (its band's padding, then half the eyebrow) and
        // fades out under the last.
        "min-[88rem]:first:before:top-[calc(var(--spacing)*24+0.5rem)]",
        "min-[88rem]:last:before:from-border min-[88rem]:last:before:bg-transparent min-[88rem]:last:before:bg-linear-to-b min-[88rem]:last:before:from-85% min-[88rem]:last:before:to-transparent",
      )}
      data-slot="stop"
      {...props}
    >
      <div
        className={cn(
          PUBLIC_CONTAINER_CLASS,
          PUBLIC_BAND_CLASS,
          "flex min-w-0 flex-col",
          className,
        )}
      >
        {children}
      </div>
    </section>
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
 * Zu's face, the flag), beside the eyebrow; on the rail from 88rem, cut out of it in its band's
 * surface. Decorative: the eyebrow says it.
 */
export function StopMark({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-foreground flex size-4 shrink-0 items-center justify-center",
        "min-[88rem]:absolute min-[88rem]:-left-13 min-[88rem]:rounded-full min-[88rem]:bg-(--stop-surface) min-[88rem]:ring-6 min-[88rem]:ring-(--stop-surface)",
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

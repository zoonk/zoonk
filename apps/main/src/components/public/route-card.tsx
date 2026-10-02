import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { type ReactNode } from "react";
import { CheckCircle } from "./check-circle";
import { FLOATING_CARD_CLASS } from "./landing-styles";

export type RouteStopState = "done" | "future" | "goal" | "now";

const MARKERS: Record<RouteStopState, ReactNode> = {
  done: <CheckCircle size="lg" />,
  future: <span className="border-border bg-card block size-7 rounded-full border-2" />,
  goal: (
    <span className="text-foreground ring-foreground bg-card flex size-7 items-center justify-center rounded-full ring-2">
      <FlagIcon aria-hidden="true" className="size-3.5" />
    </span>
  ),
  now: (
    <span className="bg-foreground flex size-7 items-center justify-center rounded-full">
      <span className="bg-background size-2.5 rounded-full" />
    </span>
  ),
};

const DASHED =
  "before:bg-[linear-gradient(180deg,var(--color-muted-foreground)_0_50%,transparent_50%_100%)] before:bg-size-[2px_8px] before:opacity-60";

/** The line to the next stop: walked (solid) up to today, still ahead (dashed) after. */
const CONNECTOR: Record<RouteStopState, string> = {
  done: "before:bg-foreground",
  future: DASHED,
  goal: "before:hidden",
  now: DASHED,
};

/**
 * One stop on a route: a marker on the line, what the stop is with a line on it, and an aside on
 * the right, like a date or a length. `children` sits under the detail, like a badge.
 */
export function RouteStop({
  aside,
  children,
  detail,
  state,
  title,
}: {
  aside?: ReactNode;
  children?: ReactNode;
  detail?: ReactNode;
  state: RouteStopState;
  title: ReactNode;
}) {
  return (
    <li
      className={cn(
        "relative flex gap-4 pb-6 before:absolute before:top-7 before:bottom-0 before:left-[13px] before:w-0.5 last:pb-0 last:before:hidden",
        CONNECTOR[state],
      )}
    >
      <span className="relative flex-none">{MARKERS[state]}</span>

      <div className="min-w-0 flex-1">
        {/* The aside sits on the title's first line, so the detail below can use the full width. */}
        <div className="flex justify-between gap-3 text-[15px]">
          <div className="min-w-0 font-semibold text-pretty">{title}</div>

          {aside && (
            <LineMarker>
              <span
                className={cn(
                  "text-[13px] whitespace-nowrap tabular-nums",
                  state === "goal" ? "text-foreground font-medium" : "text-muted-foreground",
                )}
              >
                {aside}
              </span>
            </LineMarker>
          )}
        </div>

        {detail && <p className="text-muted-foreground text-sm text-pretty">{detail}</p>}
        {children}
      </div>
    </li>
  );
}

/**
 * A path drawn as stops on a line, like a plan's phases or a chapter's lessons: done, where you
 * are now, what's ahead and the goal at the end.
 */
export function RouteStops({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={className}>{children}</ol>;
}

/**
 * A route as a floating card, like the home's example plan, a course's levels or a chapter's
 * lessons: a small label, a title, a few facts and the stops under a divider.
 */
export function RouteCard({
  children,
  className,
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <section aria-label={label} className={cn(FLOATING_CARD_CLASS, className)}>
      {children}
    </section>
  );
}

export function RouteCardEyebrow({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-[13px] font-medium">{children}</p>;
}

export function RouteCardTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 text-xl leading-tight font-semibold tracking-[-0.02em] text-balance sm:text-[23px]">
      {children}
    </p>
  );
}

export function RouteCardFacts({ children }: { children: ReactNode }) {
  return (
    <ul className="text-muted-foreground mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
      {children}
    </ul>
  );
}

/** One fact about the route, like its length or its date, after a small icon. */
export function RouteCardFact({ children, icon }: { children: ReactNode; icon: ReactNode }) {
  return (
    <li className="flex gap-1.5 leading-snug">
      <LineMarker className="[&_svg]:size-3.5 [&_svg]:opacity-70">{icon}</LineMarker>
      <span className="text-pretty">{children}</span>
    </li>
  );
}

export function RouteCardDivider() {
  return <div className="bg-border my-5 h-px sm:my-6" />;
}

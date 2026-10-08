"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { type Link, type LinkResult, arcPath } from "./cause-effect-links";

/** The gutter the arrows bow into, left of the cards. */
export const ARC_GUTTER = 48;

/** Arrows leave a card a little above its middle and arrive a little below, so pairs read apart. */
const END_OFFSET = 5;

type ArcState = LinkResult["state"] | "pending" | "made";

const ARC_STATES: readonly ArcState[] = ["correct", "incorrect", "made", "missed", "pending"];

const ARC_CLASS: Record<ArcState, string> = {
  correct: "text-success",
  incorrect: "text-destructive",
  made: "text-viz-highlight",
  missed: "text-success/70",
  pending: "text-viz-highlight/70",
};

/**
 * The links drawn as arrows between the cards. Decorative: the list of links under the cards
 * says the same in words for screen readers.
 */
export function CauseEffectArcs({
  centers,
  links,
  order,
}: {
  centers: Readonly<Record<string, number>>;
  links: readonly (Link & { state: ArcState })[];
  order: readonly string[];
}) {
  const markerId = useId();

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 left-0 h-full overflow-visible"
      width={ARC_GUTTER}
    >
      <defs>
        {ARC_STATES.map((state) => (
          <marker
            className={ARC_CLASS[state]}
            id={`${markerId}-${state}`}
            key={state}
            markerHeight={7}
            markerWidth={7}
            orient="auto"
            refX={8}
            refY={5}
            viewBox="0 0 10 10"
          >
            <path
              className="fill-none stroke-current"
              d="M1 1 L9 5 L1 9"
              strokeLinecap="round"
              strokeWidth={2}
            />
          </marker>
        ))}
      </defs>

      {links.map((link) => {
        const [from, to] = [centers[link.from], centers[link.to]];

        if (from === undefined || to === undefined) {
          return null;
        }

        const span = Math.abs(order.indexOf(link.to) - order.indexOf(link.from));

        const isDashed =
          link.state === "incorrect" || link.state === "missed" || link.state === "pending";

        return (
          <path
            className={cn("fill-none stroke-current", ARC_CLASS[link.state])}
            d={arcPath({ from: from - END_OFFSET, gutter: ARC_GUTTER, span, to: to + END_OFFSET })}
            key={`${link.from}-${link.to}-${link.state}`}
            markerEnd={`url(#${markerId}-${link.state})`}
            strokeDasharray={isDashed ? "5 5" : undefined}
            strokeLinecap="round"
            strokeWidth={2.5}
          />
        );
      })}
    </svg>
  );
}

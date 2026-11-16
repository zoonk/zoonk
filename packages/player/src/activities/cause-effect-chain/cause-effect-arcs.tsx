"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { type Link, type LinkResult, arcPath, drawsHead } from "./cause-effect-links";

export const ARC_GUTTER = 48;

const END_OFFSET = 5;
const ARC_STROKE = 2.5;
const MARKER_SIZE = 7;
const MARKER_BOX = 10;
const MARKER_REF_X = 8;
const MARKER_TIP_EDGE = 10;

/** The head's rounded tip reaches past the path's end: marker units scale with the stroke. */
const HEAD_REACH = ((MARKER_TIP_EDGE - MARKER_REF_X) * MARKER_SIZE * ARC_STROKE) / MARKER_BOX;

type ArcState = LinkResult["state"] | "pending" | "made";

const ARC_STATES: readonly ArcState[] = ["correct", "incorrect", "made", "missed", "pending"];

const ARC_CLASS: Record<ArcState, string> = {
  correct: "text-success-text",
  incorrect: "text-destructive-text",
  made: "text-foreground",
  missed: "text-success-text/70",
  pending: "text-viz-highlight/70",
};

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
  const heads = drawsHead(links);

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
            markerHeight={MARKER_SIZE}
            markerWidth={MARKER_SIZE}
            orient="auto"
            refX={MARKER_REF_X}
            refY={5}
            viewBox={`0 0 ${MARKER_BOX} ${MARKER_BOX}`}
          >
            <path
              className="fill-none stroke-current"
              d="M1 1 L9 5 L1 9"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </marker>
        ))}
      </defs>

      {links.map((link, index) => {
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
            d={arcPath({
              from: from - END_OFFSET,
              gutter: ARC_GUTTER,
              headReach: HEAD_REACH,
              span,
              to: to + END_OFFSET,
            })}
            key={`${link.from}-${link.to}-${link.state}`}
            markerEnd={heads[index] ? `url(#${markerId}-${link.state})` : undefined}
            strokeDasharray={isDashed ? "5 5" : undefined}
            strokeLinecap="round"
            strokeWidth={ARC_STROKE}
          />
        );
      })}
    </svg>
  );
}

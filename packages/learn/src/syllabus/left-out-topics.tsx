"use client";

import { CircleMinusIcon } from "lucide-react";
import { useExtracted } from "next-intl";

export function useLeftOutTopicsLabel() {
  const t = useExtracted();

  return (count: number): string =>
    t({
      description:
        "Under a module or a phase of the learner's plan, and on the row that lists them: how many of its topics the plan leaves out because they don't fit before the plan's date.",
      message: "{count, plural, one {# topic not in your plan} other {# topics not in your plan}}",
      values: { count },
    });
}

/**
 * How many topics of a module or a phase the plan's date leaves out, under its name. Once its row
 * opens, the fold inside names them, so the line steps aside.
 */
export function LeftOutTopicsLine({ count }: { count: number }) {
  const label = useLeftOutTopicsLabel();

  return count > 0 ? (
    <span
      className="text-muted-foreground flex items-center gap-1 text-xs in-data-panel-open:hidden"
      data-slot="left-out-topics-line"
    >
      <CircleMinusIcon aria-hidden="true" className="text-muted-foreground/70 size-3 shrink-0" />
      {label(count)}
    </span>
  ) : null;
}

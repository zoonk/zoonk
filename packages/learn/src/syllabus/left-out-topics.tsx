"use client";

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

/** How many topics of a module or a phase the plan's date leaves out, under its name. */
export function LeftOutTopicsLine({ count }: { count: number }) {
  const label = useLeftOutTopicsLabel();

  return count > 0 ? <span className="text-muted-foreground text-xs">{label(count)}</span> : null;
}

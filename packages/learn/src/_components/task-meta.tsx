import { cn } from "@zoonk/ui/lib/utils";
import { Fragment } from "react";

/**
 * Facts joined by "·", each its own segment that never breaks, with its dot kept beside it, so a
 * narrow line wraps between facts and never inside one ("1 fixed" stays whole).
 */
export function FactSegments({ facts }: { facts: readonly string[] }) {
  return facts.map((fact, index) => (
    <Fragment key={fact}>
      {index > 0 && "\u00A0· "}
      <span className="whitespace-nowrap">{fact}</span>
    </Fragment>
  ));
}

/**
 * A task's facts before it starts ("6 questions · 5 right to win · +300 Brain Power"), as one quiet
 * line in the mono face, the way a count or a time reads everywhere: the learner sees its size at a
 * glance, without chips or boxes. Each fact keeps its own element, so it reads (and is found) on
 * its own and wraps whole (`FactSegments`); empty ones are left out. A `reward` comes last in Brain
 * Power's violet, as every reward amount reads, offered or earned.
 */
export function TaskMeta({
  className,
  facts,
  reward,
}: {
  className?: string;
  facts: readonly (string | false | null | undefined)[];
  reward?: string;
}) {
  const shown = facts.filter((fact): fact is string => Boolean(fact));

  if (shown.length === 0 && !reward) {
    return null;
  }

  return (
    <p
      className={cn("text-muted-foreground font-mono text-xs leading-5 tabular-nums", className)}
      data-slot="task-meta"
    >
      <FactSegments facts={shown} />
      {reward && (
        <>
          {shown.length > 0 && "\u00A0· "}
          <span className="text-brain-text whitespace-nowrap">{reward}</span>
        </>
      )}
    </p>
  );
}

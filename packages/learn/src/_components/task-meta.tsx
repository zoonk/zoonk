import { cn } from "@zoonk/ui/lib/utils";
import { Fragment } from "react";

/**
 * Each fact stays whole on its line unless it's wider than the whole line, and carries the dot
 * after it, so a line never starts with one.
 */
export function FactSegments({
  facts,
  more = false,
}: {
  facts: readonly string[];
  more?: boolean;
}) {
  return facts.map((fact, index) => (
    <Fragment key={fact}>
      {index > 0 && " "}
      <span className="inline-block">{more || index < facts.length - 1 ? `${fact} ·` : fact}</span>
    </Fragment>
  ));
}

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
      <FactSegments facts={shown} more={Boolean(reward)} />
      {reward && (
        <>
          {shown.length > 0 && " "}
          <span className="text-brain-text inline-block">{reward}</span>
        </>
      )}
    </p>
  );
}

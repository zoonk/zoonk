import { cn } from "@zoonk/ui/lib/utils";
import { Fragment } from "react";

const NO_BREAK_SPACE = "\u00A0";

/**
 * Each fact stays whole on its line unless it's wider than the whole line. Its dot sits with the
 * fact after it, so a line can end on a fact but never on a dot; the line's own `text-balance`
 * keeps its last line from holding one fact's last word.
 */
export function FactSegments({
  facts,
  lead,
}: {
  facts: readonly string[];
  /** What the line opens with before its facts, such as a state in its own color. */
  lead?: React.ReactNode;
}) {
  return (
    <>
      {lead && <span className="inline-block">{lead}</span>}
      {facts.map((fact, index) => (
        <Fragment key={fact}>
          {(index > 0 || lead) && " "}
          <span className="inline-block">
            {index > 0 || lead ? `·${NO_BREAK_SPACE}${fact}` : fact}
          </span>
        </Fragment>
      ))}
    </>
  );
}

/** What follows the facts on their line, such as a reward, with the dot that joins it to them. */
export function FactExtra({
  after,
  children,
  className,
}: {
  /** Whether a fact comes before it. */
  after: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className="inline-block">
      {after && `·${NO_BREAK_SPACE}`}
      <span className={className}>{children}</span>
    </span>
  );
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
      className={cn(
        "text-muted-foreground font-mono text-xs leading-5 text-balance tabular-nums",
        className,
      )}
      data-slot="task-meta"
    >
      <FactSegments facts={shown} />
      {shown.length > 0 && reward && " "}
      {reward && (
        <FactExtra after={shown.length > 0} className="text-brain-text">
          {reward}
        </FactExtra>
      )}
    </p>
  );
}

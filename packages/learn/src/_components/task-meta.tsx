import { cn } from "@zoonk/ui/lib/utils";
import { Fragment } from "react";

const NO_BREAK_SPACE = "\u00A0";

/**
 * One fact of a line, whole on its line unless it's wider than the line. Its dot hangs before it,
 * outside its own box, over room the fact before it holds. So a line ends on a fact, and the dot
 * of a line's first fact falls outside the line, where `FactSegments` cuts it.
 */
function Fact({
  children,
  first,
  last,
}: {
  children: React.ReactNode;
  first: boolean;
  last: boolean;
}) {
  return (
    <span className="relative inline-block">
      {!first && <span className="absolute inset-e-full whitespace-pre">{"· "}</span>}
      {children}
      {!last && (
        <span aria-hidden="true" className="invisible">
          {`${NO_BREAK_SPACE}·`}
        </span>
      )}
    </span>
  );
}

/**
 * The facts of one line with a dot between them ("4 lessons · 12 min"). A line that wraps never
 * ends or starts on a dot, and the line's own `text-balance` keeps its last line from holding one
 * fact alone.
 */
export function FactSegments({
  extra,
  facts,
  lead,
}: {
  /** What follows the facts, such as a reward in its own color. */
  extra?: React.ReactNode;
  facts: readonly (string | false | null | undefined)[];
  /** What the line opens with before its facts, such as a state in its own color. */
  lead?: React.ReactNode;
}) {
  const items = [
    ...(lead ? [{ content: lead, key: "lead" }] : []),
    ...facts.flatMap((fact) => (fact ? [{ content: fact, key: `fact:${fact}` }] : [])),
    ...(extra ? [{ content: extra, key: "extra" }] : []),
  ];

  return (
    <span className="block overflow-x-clip">
      {items.map((item, index) => (
        <Fragment key={item.key}>
          {index > 0 && " "}
          <Fact first={index === 0} last={index === items.length - 1}>
            {item.content}
          </Fact>
        </Fragment>
      ))}
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
  if (!facts.some(Boolean) && !reward) {
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
      <FactSegments
        extra={reward && <span className="text-brain-text">{reward}</span>}
        facts={facts}
      />
    </p>
  );
}

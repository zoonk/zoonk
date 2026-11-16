import { cn } from "@zoonk/ui/lib/utils";
import { Fragment } from "react";
import { BrainPowerAmount } from "./brain-power-amount";

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
 * fact alone. For lines that start on their column's start edge: an end-aligned line's first dot
 * would fall inside the line, where nothing cuts it.
 */
export function FactSegments({
  extra,
  facts,
  lead,
}: {
  /** What follows the facts, such as a reward in its own color. */
  extra?: React.ReactNode;
  /** A fact that isn't plain words (a link) brings its own key. */
  facts: readonly (string | { content: React.ReactNode; key: string } | false | null | undefined)[];
  /** What the line opens with before its facts, such as a state in its own color. */
  lead?: React.ReactNode;
}) {
  const items = [
    ...(lead ? [{ content: lead, key: "lead" }] : []),
    ...facts.flatMap((fact) => {
      if (!fact) {
        return [];
      }

      return typeof fact === "string" ? [{ content: fact, key: `fact:${fact}` }] : [fact];
    }),
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
  /** The Brain Power the task gives. */
  reward?: number;
}) {
  if (!facts.some(Boolean) && reward === undefined) {
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
        extra={reward !== undefined && <BrainPowerAmount points={reward} />}
        facts={facts}
      />
    </p>
  );
}

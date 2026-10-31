import { cn } from "@zoonk/ui/lib/utils";
import { Fragment } from "react";

export function FactSegments({ facts }: { facts: readonly string[] }) {
  return facts.map((fact, index) => (
    <Fragment key={fact}>
      {index > 0 && "\u00A0· "}
      <span className="whitespace-nowrap">{fact}</span>
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

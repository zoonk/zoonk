"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { CircleCheck, CircleDashed } from "lucide-react";
import { useExtracted } from "next-intl";

type BalanceStepRow = { equation: string; move: string };

/**
 * The written solution as a checklist: steps the learner reached are ticked with their equation,
 * and the next one waits, dimmed, as a nudge. After the check every step shows.
 */
export function BalanceSteps({
  reached,
  showAll,
  steps,
}: {
  reached: number;
  showAll: boolean;
  steps: readonly BalanceStepRow[];
}) {
  const t = useExtracted();
  const visible = showAll ? steps : steps.slice(0, reached + 1);

  return (
    <ol aria-label={t("Solution steps")} className="flex flex-col gap-2" data-slot="balance-steps">
      {visible.map((step, index) => {
        const isDone = showAll || index < reached;

        return (
          // oxlint-disable-next-line react/no-array-index-key -- Steps are positional
          <li className="flex items-start gap-2 text-sm" key={index}>
            {isDone ? (
              <CircleCheck aria-hidden="true" className="text-success mt-0.5 size-4 shrink-0" />
            ) : (
              <CircleDashed
                aria-hidden="true"
                className="text-muted-foreground mt-0.5 size-4 shrink-0"
              />
            )}

            <span className={cn("tabular-nums", !isDone && "text-muted-foreground")}>
              <span className="sr-only">{isDone ? t("Done:") : t("Next:")} </span>
              {isDone ? t("{move}: {equation}", step) : step.move}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

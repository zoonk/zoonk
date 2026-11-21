"use client";

import { useExtracted, useFormatter } from "next-intl";
import { useLearnRoutes } from "../learn-context";
import { LearnLink } from "../learn-link";

/** A written task that waits for an exam choice says which, on the row it limits. */
export function useChoiceLine() {
  const t = useExtracted();
  const format = useFormatter();

  return (choiceGroups: readonly string[]): string =>
    t({
      description:
        "Under a written test or question whose question depends on an exam choice the learner hasn't made, such as which specialty they'll take. {groups} names the choices.",
      message: "Depends on your choice of {groups}",
      values: { groups: format.list(choiceGroups, { type: "conjunction" }) },
    });
}

/** Today asks the exam's open choices ("which one will you take?"), so a written task waiting for one leads there. */
export function ChooseOnToday({
  choiceGroups,
  task,
}: {
  choiceGroups: readonly string[];
  /** The one task that waits, when others don't, named as the notice names it. */
  task?: string;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const routes = useLearnRoutes();
  const choiceLine = useChoiceLine();

  const line = task
    ? t({
        description:
          'Under a written test where one question waits for an exam choice the learner hasn\'t made. {task} is the question, such as "The 60-line question"; {groups} names the choices.',
        message: "{task} depends on your choice of {groups}",
        values: { groups: format.list(choiceGroups, { type: "conjunction" }), task },
      })
    : choiceLine(choiceGroups);

  return (
    <p
      className="text-muted-foreground flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-pretty"
      role="status"
    >
      <span>{line}</span>
      <LearnLink
        className="text-foreground font-medium underline underline-offset-4"
        href={routes.today}
      >
        {t("Choose on Today")}
      </LearnLink>
    </p>
  );
}

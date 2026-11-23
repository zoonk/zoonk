"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useExtracted, useFormatter } from "next-intl";
import { DETAIL_PRIMARY_CLASS } from "../_components/detail-page";
import { EnterLink } from "../_components/enter-button";
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

/** The sentence under a written task that waits for an exam choice, naming the task when others don't wait. */
export function useChoiceSentence() {
  const t = useExtracted();
  const format = useFormatter();
  const choiceLine = useChoiceLine();

  return ({ choiceGroups, task }: { choiceGroups: readonly string[]; task?: string }) =>
    task
      ? t({
          description:
            'Under a written test where one question waits for an exam choice the learner hasn\'t made. {task} is the question, such as "The 60-line question"; {groups} names the choices.',
          message: "{task} depends on your choice of {groups}",
          values: { groups: format.list(choiceGroups, { type: "conjunction" }), task },
        })
      : choiceLine(choiceGroups);
}

/** Today asks the exam's open choices ("which one will you take?"): the way there, as a bar's main action. */
export function ChooseOnTodayLink() {
  const t = useExtracted();
  const routes = useLearnRoutes();

  return (
    <EnterLink className={DETAIL_PRIMARY_CLASS} href={routes.today} size="lg">
      {t("Choose on Today")}
    </EnterLink>
  );
}

/**
 * A note over a bar whose main action still works: which task waits for a choice, and the way to
 * Today's question as a small button beside it.
 */
export function ChooseOnToday({
  choiceGroups,
  task,
}: {
  choiceGroups: readonly string[];
  /** The one task that waits, when others don't, named as the notice names it. */
  task?: string;
}) {
  const t = useExtracted();
  const routes = useLearnRoutes();
  const sentence = useChoiceSentence();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 lg:justify-end" role="status">
      <p className="text-muted-foreground text-sm text-pretty">
        {sentence({ choiceGroups, task })}
      </p>
      <LearnLink className={buttonVariants({ size: "sm", variant: "outline" })} href={routes.today}>
        {t("Choose on Today")}
      </LearnLink>
    </div>
  );
}

"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { Badge } from "@zoonk/ui/components/badge";
import { useExtracted, useFormatter } from "next-intl";
import { ItemLine } from "../questions/item-text";
import { useTrueFalseLabels } from "../questions/use-true-false-labels";
import { type MistakeEntry } from "./mistakes-notebook";
import { useCauseLabel } from "./use-cause-label";

/**
 * One notebook entry: the question, what the learner answered, the right answer and why. A
 * statement's answers are saved as "true" or "false" and read in the goal's exam's words.
 */
export function MistakeEntryCard({
  mistake,
  trueFalseLabels,
}: {
  mistake: MistakeEntry;
  trueFalseLabels: TrueFalseLabels;
}) {
  const t = useExtracted();
  const format = useFormatter();
  const causeLabel = useCauseLabel();
  const { answerText } = useTrueFalseLabels(trueFalseLabels);
  const { snapshot } = mistake;
  const answer = answerText(snapshot.answer);
  const correct = answerText(snapshot.correctAnswer);

  return (
    <li
      className="bg-card ring-foreground/10 in-data-[mode=fun]:fun-paper flex flex-col gap-2 rounded-2xl p-4 ring-1"
      data-status={mistake.status}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{causeLabel(mistake.cause)}</Badge>
        {mistake.status === "fixed" && <Badge variant="secondary">{t("Fixed")}</Badge>}
        <span className="text-muted-foreground ml-auto text-xs">
          {format.dateTime(mistake.createdAt, { day: "numeric", month: "short" })}
        </span>
      </div>
      <p className="text-sm font-medium">
        <ItemLine text={snapshot.question} />
      </p>
      {answer && (
        <p className="text-muted-foreground text-sm">{t("You answered: {answer}", { answer })}</p>
      )}
      {correct && <p className="text-sm">{t("Right answer: {answer}", { answer: correct })}</p>}
      {snapshot.explanation && (
        <p className="text-muted-foreground text-sm">{snapshot.explanation}</p>
      )}
    </li>
  );
}

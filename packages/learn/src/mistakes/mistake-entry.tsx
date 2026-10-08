"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ItemLine } from "../questions/item-text";
import { useTrueFalseLabels } from "../questions/use-true-false-labels";
import { type MistakeEntry } from "./mistakes-notebook";
import { useCauseLabel } from "./use-cause-label";

/** One answer line: a mark the eye reads at once (✗ yours, ✓ the right one), named for readers. */
function AnswerLine({ children, kind }: { children: React.ReactNode; kind: "learner" | "right" }) {
  const t = useExtracted();

  return (
    <p className={kind === "right" ? "flex gap-2" : "text-muted-foreground flex gap-2"}>
      <LineMarker aria-hidden="true">
        {kind === "right" ? (
          <CheckIcon className="text-success size-4" />
        ) : (
          <XIcon className="text-destructive size-4" />
        )}
      </LineMarker>
      <span className="min-w-0">
        <span className="sr-only">
          {kind === "right" ? t("Right answer:") : t("You answered:")}{" "}
        </span>
        {children}
      </span>
    </p>
  );
}

/**
 * One notebook entry: why it happened (a quiet label), the question, what the learner answered
 * against the right answer, and why. A statement's answers are saved as "true" or "false" and
 * read in the goal's exam's words.
 */
export function MistakeEntryCard({
  mistake,
  trueFalseLabels,
}: {
  mistake: MistakeEntry;
  trueFalseLabels: TrueFalseLabels;
}) {
  const t = useExtracted();
  const causeLabel = useCauseLabel();
  const { answerText } = useTrueFalseLabels(trueFalseLabels);
  const { snapshot } = mistake;
  const answer = answerText(snapshot.answer);
  const correct = answerText(snapshot.correctAnswer);

  return (
    <li
      className="border-border flex flex-col gap-2 border-t py-4 text-sm first:border-t-0 first:pt-1"
      data-slot="mistake-entry"
      data-status={mistake.status}
    >
      <p className="text-muted-foreground text-xs font-medium">
        {mistake.status === "fixed"
          ? t("{cause} · Fixed", { cause: causeLabel(mistake.cause) })
          : causeLabel(mistake.cause)}
      </p>
      <p className="font-medium">
        <ItemLine text={snapshot.question} />
      </p>
      {answer && <AnswerLine kind="learner">{answer}</AnswerLine>}
      {correct && <AnswerLine kind="right">{correct}</AnswerLine>}
      {snapshot.explanation && (
        <p className="text-muted-foreground leading-relaxed">{snapshot.explanation}</p>
      )}
    </li>
  );
}

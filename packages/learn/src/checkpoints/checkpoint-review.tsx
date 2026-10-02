"use client";

import { type CheckpointQuestion } from "@zoonk/core/checkpoints/contract";
import { type StudyBlockCompletionView } from "@zoonk/core/sessions/completion-contract";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { ContentVoteMenu } from "../feedback/content-vote-menu";
import { ItemLine } from "../questions/item-text";
import { WorkedSteps, useAnswerText } from "../session/question-block/question-feedback";
import { useCheckpointScreen } from "./checkpoint-context";

type ReviewedAnswer = NonNullable<StudyBlockCompletionView["checkpoint"]>["answers"][number];

function ReviewItem({
  answer,
  question,
}: {
  answer: ReviewedAnswer;
  question: CheckpointQuestion;
}) {
  const t = useExtracted();
  const { checkpoint } = useCheckpointScreen();
  const answerText = useAnswerText(checkpoint.trueFalseLabels);
  const rightAnswer = answerText({ answer: answer.correctAnswer, question });

  return (
    <li className="border-border flex items-start gap-3 border-b py-4 last:border-b-0">
      <LineMarker>
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full",
            answer.isCorrect ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          {answer.isCorrect ? (
            <CheckIcon aria-label={t("Right")} className="size-4" role="img" />
          ) : (
            <XIcon aria-label={t("Not this time")} className="size-4" role="img" />
          )}
        </span>
      </LineMarker>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium">
          <ItemLine text={question.question} />
        </p>
        {rightAnswer && (
          <p className="text-sm">
            <span className="text-muted-foreground">{t("Answer:")}</span> {rightAnswer}
          </p>
        )}
        {answer.explanation && (
          <p className="text-muted-foreground text-sm">{answer.explanation}</p>
        )}
        {!answer.isCorrect && <WorkedSteps steps={answer.workedSteps} />}
      </div>

      {/* The duel has no hints or menus; its questions are voted on here, once it's over. */}
      <ContentVoteMenu
        label={t("Question options")}
        screen="checkpoint-review"
        target={{ contentId: answer.itemId, contentKind: "item" }}
      />
    </li>
  );
}

/**
 * Now that the duel is over, each question's right answer and why, the traps included. Closed by
 * default so the result reads first; learning from it is one tap away.
 */
export function CheckpointReview() {
  const t = useExtracted();
  const { checkpoint, duel } = useCheckpointScreen();
  const answers = duel.state.completion?.checkpoint?.answers ?? [];

  if (answers.length === 0) {
    return null;
  }

  return (
    <details className="group border-border in-data-[mode=fun]:fun-glass rounded-3xl border px-4">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 font-semibold [&::-webkit-details-marker]:hidden">
        {t("Review the answers")}
        <ChevronDownIcon
          aria-hidden="true"
          className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>

      <ol className="flex flex-col">
        {answers.map((answer) => {
          const question = checkpoint.questions.find(
            (candidate) => candidate.itemId === answer.itemId,
          );

          return question ? (
            <ReviewItem answer={answer} key={answer.itemId} question={question} />
          ) : null;
        })}
      </ol>
    </details>
  );
}

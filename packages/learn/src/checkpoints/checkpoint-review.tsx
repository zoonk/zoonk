"use client";

import { type CheckpointQuestion } from "@zoonk/core/checkpoints/contract";
import { type StudyBlockCompletionView } from "@zoonk/core/sessions/completion-contract";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { AnswerOption, AnswerOptionGroup } from "../_components/answer-option";
import { DetailsDrawer } from "../_components/details-drawer";
import { PageSectionTitle } from "../_components/page";
import { ContentFeedbackMenu } from "../feedback/content-feedback-menu";
import { ItemSetStimulus } from "../questions/item-set-stimulus";
import { ItemLine, ItemStem, ItemText } from "../questions/item-text";
import { useTrueFalseLabels } from "../questions/use-true-false-labels";
import { WorkedSteps, useAnswerText } from "../session/question-block/question-feedback";
import { useCheckpointScreen } from "./checkpoint-context";
import { getReviewedOptions } from "./review-options";

type ReviewedAnswer = NonNullable<StudyBlockCompletionView["checkpoint"]>["answers"][number];

export function useReviewedAnswers(): ReviewedAnswer[] {
  const { duel } = useCheckpointScreen();
  return duel.state.completion?.checkpoint?.answers ?? [];
}

function ReviewAnswer({
  answer,
  question,
}: {
  answer: ReviewedAnswer;
  question: CheckpointQuestion;
}) {
  const t = useExtracted();
  const { answersGiven, checkpoint } = useCheckpointScreen();
  const { answerLabel } = useTrueFalseLabels(checkpoint.trueFalseLabels);
  const answerText = useAnswerText(checkpoint.trueFalseLabels);

  const labels =
    question.format === "trueFalse"
      ? [answerLabel(true), answerLabel(false)]
      : (question.options ?? []);

  const options = getReviewedOptions({
    correctAnswer: answer.correctAnswer,
    given: answersGiven[answer.itemId] ?? null,
    isCorrect: answer.isCorrect,
    optionCount: labels.length,
  });

  if (options && options.length > 0) {
    return (
      <AnswerOptionGroup>
        {options.map((option) => (
          <AnswerOption
            disabled
            key={option.index}
            marker={option.index + 1}
            picked={option.picked}
            result={option.result}
          >
            <ItemLine text={labels[option.index] ?? ""} />
          </AnswerOption>
        ))}
      </AnswerOptionGroup>
    );
  }

  const rightAnswer = answerText({ answer: answer.correctAnswer, question });

  if (!rightAnswer) {
    return null;
  }

  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{t("Answer:")}</span>{" "}
      <span className={cn(question.format === "numeric" && "font-mono tabular-nums")}>
        {rightAnswer}
      </span>
    </p>
  );
}

function ReviewItem({
  answer,
  question,
}: {
  answer: ReviewedAnswer;
  question: CheckpointQuestion;
}) {
  const t = useExtracted();

  return (
    <li className="border-border flex flex-col gap-3 border-b py-4 first:pt-0 last:border-b-0">
      <div className="flex items-start gap-3">
        <LineMarker className={answer.isCorrect ? "text-success-text" : "text-destructive-text"}>
          {answer.isCorrect ? (
            <CheckIcon aria-label={t("Correct")} className="size-4" role="img" />
          ) : (
            <XIcon aria-label={t("Not quite")} className="size-4" role="img" />
          )}
        </LineMarker>

        <div className="min-w-0 flex-1 font-medium text-pretty">
          <ItemStem text={question.question} />
        </div>

        <ContentFeedbackMenu
          label={t("Question options")}
          screen="checkpoint-review"
          target={{ contentId: answer.itemId, contentKind: "item" }}
        />
      </div>

      <div className="flex flex-col gap-3 pl-7">
        <ReviewAnswer answer={answer} question={question} />
        {answer.explanation && (
          <ItemText className="text-muted-foreground text-sm" text={answer.explanation} />
        )}
        {!answer.isCorrect && <WorkedSteps steps={answer.workedSteps} />}
      </div>
    </li>
  );
}

function ReviewRecordings() {
  const { checkpoint, duel } = useCheckpointScreen();

  const sets = [
    ...new Map(
      checkpoint.questions.flatMap((question) =>
        question.set?.listening && duel.state.verdicts[question.itemId] !== undefined
          ? [[question.set.id, question.set] as const]
          : [],
      ),
    ).values(),
  ];

  return sets.map((set) => (
    <ItemSetStimulus
      askedIn={checkpoint.blockId}
      key={set.id}
      place={false}
      set={set}
      transcript={duel.state.transcripts[set.id] ?? null}
    />
  ));
}

function ReviewList() {
  const { checkpoint } = useCheckpointScreen();
  const answers = useReviewedAnswers();

  return (
    <div className="flex flex-col gap-4">
      <ReviewRecordings />
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
    </div>
  );
}

export function CheckpointReviewSection() {
  const t = useExtracted();
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="flex w-full flex-col gap-3">
      <PageSectionTitle id={titleId}>{t("The answers")}</PageSectionTitle>
      <ReviewList />
    </section>
  );
}

export function CheckpointReviewDrawer() {
  const t = useExtracted();

  return (
    <DetailsDrawer label={t("Review the answers")} title={t("The answers")} trigger="secondary">
      <ReviewList />
    </DetailsDrawer>
  );
}

"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import { useMemo } from "react";
import { QuestionTitle } from "../_components/question-title";
import { ItemSetStimulus } from "../questions/item-set-stimulus";
import { ItemSupport } from "../questions/item-text";
import { useSpokenText } from "../rich-text/use-spoken-text";
import { QuestionInputs } from "../session/question-block/question-view";
import { type PracticeStep as Step } from "./mistake-practice-state";
import { type useMistakePractice } from "./use-mistake-practice";

type Run = ReturnType<typeof useMistakePractice>;

function QuestionLead({
  graded,
  question,
  withTitle,
}: {
  graded: boolean;
  question: NonNullable<Step["question"]>;
  withTitle: boolean;
}) {
  return (
    <>
      <ItemSupport context={question.context} image={question.image} visual={question.visual} />
      {withTitle && <QuestionTitle muted={graded} text={question.question} />}
    </>
  );
}

export function BankPracticeQuestion({
  question,
  run,
  trueFalseLabels,
}: {
  question: NonNullable<Step["question"]>;
  run: Run;
  trueFalseLabels: TrueFalseLabels;
}) {
  const spoken = useSpokenText();
  const runId = useMemo(() => crypto.randomUUID(), []);
  const { phase } = run.state;
  const graded = phase.kind === "feedback" ? phase : null;
  const disabled = phase.kind === "checking";

  return (
    <>
      {question.set && (
        <ItemSetStimulus askedIn={runId} key={question.itemId} practice set={question.set} />
      )}

      <section
        aria-label={spoken.blocks(question.question)}
        className="flex flex-col gap-4"
        key={question.itemId}
      >
        <QuestionLead
          graded={graded !== null}
          question={question}
          withTitle={question.format !== "trueFalse"}
        />

        <QuestionInputs
          allowBlank={false}
          disabled={disabled || graded !== null}
          onChange={run.select}
          onSubmit={run.check}
          question={question}
          result={
            graded && !("kind" in graded.answer)
              ? {
                  answer: graded.answer,
                  correctAnswer: graded.feedback.correctAnswer,
                  isCorrect: graded.feedback.isCorrect,
                }
              : null
          }
          trueFalseLabels={trueFalseLabels}
        />
      </section>
    </>
  );
}

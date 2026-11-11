"use client";

import { type TrueFalseLabels } from "@zoonk/core/library/exams/true-false-labels";
import {
  type StudyBlockDetail,
  type StudyQuestion,
  type StudyQuestionAnswer,
} from "../session-types";
import { ChoiceQuestion, type ChoiceResult } from "./choice-question";
import { MatchPairsQuestion } from "./match-pairs-question";
import { NumericQuestion } from "./numeric-question";
import { OrderQuestion, type OrderResult } from "./order-question";
import { type QuestionBlockPhase } from "./question-block-state";
import { TrueFalseQuestion, type TrueFalseResult } from "./true-false-question";
import { TypedQuestion } from "./typed-question";

function getPicks(answer: StudyQuestionAnswer | null): number[] {
  if (!answer) {
    return [];
  }

  if ("selectedIndex" in answer) {
    return [answer.selectedIndex];
  }

  return "selectedIndexes" in answer ? answer.selectedIndexes : [];
}

type QuestionResult = {
  answer: StudyQuestionAnswer;
  correctAnswer: StudyQuestionAnswer | null;
  isCorrect: boolean;
};

function getChoiceResult(result: QuestionResult | null): ChoiceResult | null {
  return result
    ? { correct: getPicks(result.correctAnswer), picked: getPicks(result.answer) }
    : null;
}

function getTrueFalseResult(result: QuestionResult | null): TrueFalseResult | null {
  if (!result) {
    return null;
  }

  const { answer, correctAnswer } = result;

  return {
    answer: "isTrue" in answer ? { isTrue: answer.isTrue } : { dontKnow: true },
    correct: correctAnswer && "isTrue" in correctAnswer ? correctAnswer.isTrue : null,
  };
}

function getOrderResult(result: QuestionResult | null): OrderResult | null {
  if (!result || !("order" in result.answer)) {
    return null;
  }

  const correct = result.correctAnswer;

  return {
    correctOrder: correct && "order" in correct ? correct.order : [],
    order: result.answer.order,
  };
}

function getAnswerMark(result: QuestionResult | null): "correct" | "wrong" | null {
  if (!result || "dontKnow" in result.answer) {
    return null;
  }

  return result.isCorrect ? "correct" : "wrong";
}

export function isNetScoredQuestion({
  detail,
  question,
}: {
  detail: StudyBlockDetail;
  question: StudyQuestion | null;
}) {
  const capsule = detail.block.capsules.find((candidate) => candidate.key === question?.capsuleKey);
  return capsule ? capsule.format === "swipe" : detail.block.netScored;
}

/**
 * `onChange` gets the answer as it's made, null until complete; `onSubmit` gets a typed answer
 * Enter sends from its field.
 */
export function QuestionView({
  detail,
  onChange,
  onSubmit,
  phase,
  question,
}: {
  detail: StudyBlockDetail;
  onChange: (answer: StudyQuestionAnswer | null) => void;
  onSubmit: (answer: StudyQuestionAnswer) => void;
  phase: QuestionBlockPhase;
  question: StudyQuestion;
}) {
  return (
    <QuestionInputs
      allowBlank={isNetScoredQuestion({ detail, question })}
      disabled={phase.kind !== "answering" && phase.kind !== "answerFailed"}
      onChange={onChange}
      onSubmit={onSubmit}
      question={question}
      result={
        phase.kind === "feedback"
          ? {
              answer: phase.answer,
              correctAnswer: phase.feedback.correctAnswer,
              isCorrect: phase.feedback.isCorrect,
            }
          : null
      }
      trueFalseLabels={detail.trueFalseLabels}
    />
  );
}

export function QuestionInputs({
  allowBlank,
  disabled,
  onChange,
  onSubmit,
  question,
  result,
  trueFalseLabels,
}: {
  allowBlank: boolean;
  disabled: boolean;
  onChange: (answer: StudyQuestionAnswer | null) => void;
  onSubmit: (answer: StudyQuestionAnswer) => void;
  question: Pick<
    StudyQuestion,
    "format" | "entry" | "unit" | "options" | "left" | "right" | "question" | "select"
  >;
  result: QuestionResult | null;
  trueFalseLabels: TrueFalseLabels;
}) {
  if (question.format === "numeric") {
    return (
      <NumericQuestion
        disabled={disabled}
        entry={question.entry}
        onChange={onChange}
        onSubmit={onSubmit}
        result={getAnswerMark(result)}
        unit={question.unit}
      />
    );
  }

  if (question.format === "typed") {
    return (
      <TypedQuestion
        disabled={disabled}
        onChange={onChange}
        onSubmit={onSubmit}
        result={getAnswerMark(result)}
      />
    );
  }

  if (question.format === "order") {
    return (
      <OrderQuestion
        disabled={disabled}
        onChange={onChange}
        result={getOrderResult(result)}
        steps={question.options ?? []}
      />
    );
  }

  if (question.format === "matchPairs") {
    return (
      <MatchPairsQuestion
        disabled={disabled}
        left={question.left ?? []}
        onChange={onChange}
        right={question.right ?? []}
      />
    );
  }

  if (question.format === "trueFalse") {
    return (
      <TrueFalseQuestion
        allowBlank={allowBlank}
        disabled={disabled}
        onChange={onChange}
        result={getTrueFalseResult(result)}
        statement={question.question}
        trueFalseLabels={trueFalseLabels}
      />
    );
  }

  return (
    <ChoiceQuestion
      disabled={disabled}
      onChange={onChange}
      options={question.options ?? []}
      result={getChoiceResult(result)}
      select={question.select}
    />
  );
}

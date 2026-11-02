"use client";

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

function getChoiceResult(phase: QuestionBlockPhase): ChoiceResult | null {
  if (phase.kind !== "feedback") {
    return null;
  }

  return { correct: getPicks(phase.feedback.correctAnswer), picked: getPicks(phase.answer) };
}

function getTrueFalseResult(phase: QuestionBlockPhase): TrueFalseResult | null {
  if (phase.kind !== "feedback") {
    return null;
  }

  const { answer } = phase;
  const correct = phase.feedback.correctAnswer;

  return {
    answer: "isTrue" in answer ? { isTrue: answer.isTrue } : { dontKnow: true },
    correct: correct && "isTrue" in correct ? correct.isTrue : null,
  };
}

function getOrderResult(phase: QuestionBlockPhase): OrderResult | null {
  if (phase.kind !== "feedback" || !("order" in phase.answer)) {
    return null;
  }

  const correct = phase.feedback.correctAnswer;

  return {
    correctOrder: correct && "order" in correct ? correct.order : [],
    order: phase.answer.order,
  };
}

function getAnswerMark(phase: QuestionBlockPhase): "correct" | "wrong" | null {
  if (phase.kind !== "feedback" || "dontKnow" in phase.answer) {
    return null;
  }

  return phase.feedback.isCorrect ? "correct" : "wrong";
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
  const locked = phase.kind !== "answering" && phase.kind !== "answerFailed";

  if (question.format === "numeric") {
    return (
      <NumericQuestion
        disabled={locked}
        entry={question.entry}
        onChange={onChange}
        onSubmit={onSubmit}
        result={getAnswerMark(phase)}
        unit={question.unit}
      />
    );
  }

  if (question.format === "typed") {
    return (
      <TypedQuestion
        disabled={locked}
        onChange={onChange}
        onSubmit={onSubmit}
        result={getAnswerMark(phase)}
      />
    );
  }

  if (question.format === "order") {
    return (
      <OrderQuestion
        disabled={locked}
        onChange={onChange}
        result={getOrderResult(phase)}
        steps={question.options ?? []}
      />
    );
  }

  if (question.format === "matchPairs") {
    return (
      <MatchPairsQuestion
        disabled={locked}
        left={question.left ?? []}
        onChange={onChange}
        right={question.right ?? []}
      />
    );
  }

  if (question.format === "trueFalse") {
    return (
      <TrueFalseQuestion
        allowBlank={isNetScoredQuestion({ detail, question })}
        disabled={locked}
        onChange={onChange}
        result={getTrueFalseResult(phase)}
        statement={question.question}
        trueFalseLabels={detail.trueFalseLabels}
      />
    );
  }

  return (
    <ChoiceQuestion
      disabled={locked}
      onChange={onChange}
      options={question.options ?? []}
      result={getChoiceResult(phase)}
      select={question.select}
    />
  );
}

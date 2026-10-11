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
import { TrueFalseQuestion } from "./true-false-question";
import { TypedQuestion } from "./typed-question";

/** The options an answer picks: one, several, or none for another shape. */
function getPicks(answer: StudyQuestionAnswer | null): number[] {
  if (!answer) {
    return [];
  }

  if ("selectedIndex" in answer) {
    return [answer.selectedIndex];
  }

  return "selectedIndexes" in answer ? answer.selectedIndexes : [];
}

/** What a graded choice question marks: the right options, and the ones the learner picked. */
function getChoiceResult(phase: QuestionBlockPhase): ChoiceResult | null {
  if (phase.kind !== "feedback") {
    return null;
  }

  const picked = getPicks(phase.answer);
  return picked.length > 0 ? { correct: getPicks(phase.feedback.correctAnswer), picked } : null;
}

/** Where a graded ordering question put each step, and where each one goes. */
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

/** A typed answer's mark once graded, a number's or a word's. */
function getAnswerMark(phase: QuestionBlockPhase): "correct" | "wrong" | null {
  if (phase.kind !== "feedback") {
    return null;
  }

  return phase.feedback.isCorrect ? "correct" : "wrong";
}

/** Scored net (Cebraspe), where a wrong answer cancels a right one: a swipe capsule or practice. */
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

/** The question's answer control for its format; the key resets it for every question. */
export function QuestionView({
  detail,
  onAnswer,
  phase,
  question,
}: {
  detail: StudyBlockDetail;
  onAnswer: (answer: StudyQuestionAnswer) => void;
  phase: QuestionBlockPhase;
  question: StudyQuestion;
}) {
  const locked = phase.kind !== "answering" && phase.kind !== "answerFailed";

  if (question.format === "numeric") {
    return (
      <NumericQuestion
        disabled={locked}
        entry={question.entry}
        onAnswer={onAnswer}
        result={getAnswerMark(phase)}
        unit={question.unit}
      />
    );
  }

  if (question.format === "typed") {
    return <TypedQuestion disabled={locked} onAnswer={onAnswer} result={getAnswerMark(phase)} />;
  }

  if (question.format === "order") {
    return (
      <OrderQuestion
        disabled={locked}
        onAnswer={onAnswer}
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
        onAnswer={onAnswer}
        right={question.right ?? []}
      />
    );
  }

  if (question.format === "trueFalse") {
    return (
      <TrueFalseQuestion
        allowBlank={isNetScoredQuestion({ detail, question })}
        disabled={locked}
        onAnswer={onAnswer}
        statement={question.question}
        trueFalseLabels={detail.trueFalseLabels}
      />
    );
  }

  return (
    <ChoiceQuestion
      disabled={locked}
      onAnswer={onAnswer}
      options={question.options ?? []}
      result={getChoiceResult(phase)}
      select={question.select}
    />
  );
}

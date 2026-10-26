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

/**
 * What a graded choice question marks: the right options, and the ones the learner picked (none
 * for "I'm not sure", which still shows the right one).
 */
function getChoiceResult(phase: QuestionBlockPhase): ChoiceResult | null {
  if (phase.kind !== "feedback") {
    return null;
  }

  return { correct: getPicks(phase.feedback.correctAnswer), picked: getPicks(phase.answer) };
}

/** What a graded statement marks: its right answer, and the learner's (a blank included). */
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

/**
 * A typed answer's mark once graded, a number's or a word's. "I don't know yet" (or a drill's clock
 * running out) leaves the field empty, with nothing to mark wrong: the verdict says what happened.
 */
function getAnswerMark(phase: QuestionBlockPhase): "correct" | "wrong" | null {
  if (phase.kind !== "feedback" || "dontKnow" in phase.answer) {
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

/**
 * The question's answer control for its format; the key resets it for every question. It hands
 * the host the answer as it's made (`onChange`, null until complete) for the host's Check, and a
 * typed answer straight away when Enter sends it from its field (`onSubmit`).
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

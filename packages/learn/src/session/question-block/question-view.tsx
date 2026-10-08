"use client";

import {
  type StudyBlockDetail,
  type StudyQuestion,
  type StudyQuestionAnswer,
} from "../session-types";
import { ChoiceQuestion, type ChoiceResult } from "./choice-question";
import { MatchPairsQuestion } from "./match-pairs-question";
import { NumericQuestion } from "./numeric-question";
import { type QuestionBlockPhase } from "./question-block-state";
import { TrueFalseQuestion } from "./true-false-question";

/** What a graded choice question marks: the right option and, when it was missed, the pick. */
function getChoiceResult(phase: QuestionBlockPhase): ChoiceResult | null {
  if (phase.kind !== "feedback" || !("selectedIndex" in phase.answer)) {
    return null;
  }

  const correct = phase.feedback.correctAnswer;
  const correctIndex = correct && "selectedIndex" in correct ? correct.selectedIndex : null;

  return {
    correctIndex,
    pickedIndex: phase.feedback.isCorrect ? null : phase.answer.selectedIndex,
  };
}

function getNumericResult(phase: QuestionBlockPhase): "correct" | "wrong" | null {
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
        onAnswer={onAnswer}
        result={getNumericResult(phase)}
        unit={question.unit}
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
    />
  );
}

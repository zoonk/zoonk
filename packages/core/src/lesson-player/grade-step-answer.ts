import { checkActivityAnswer } from "../library/activities/activity-answers";
import { gradeChallengePath } from "../library/challenges/challenge-run";
import { type SelectedAnswer } from "../player/contracts/_utils/selected-answer-schema";
import { checkStepAnswer } from "../player/contracts/check-step-answer";
import { type SerializedStep } from "../player/contracts/prepare-lesson-data";
import {
  type LessonStepAnswer,
  type PlayableLanguageStep,
  type PlayableLibraryStep,
  type PlayableSpokenAnswerStep,
  type PlayableTeachingStepOf,
} from "./contract";

/** A verdict code can reach from the screen's content alone. */
export type GradedStepAnswer = {
  /** The learner's answer as text, for the mistakes notebook. */
  answerText: string | null;
  /** The right answer as text when the learner missed it. */
  correctAnswer: string | null;
  /** Why the answer is right or wrong: the option's reason or the check's explanation. */
  feedback: string | null;
  isCorrect: boolean;
};

type Grade<TAnswer extends LessonStepAnswer["kind"]> = {
  answer: Extract<LessonStepAnswer, { kind: TAnswer }>;
};

function gradeCheck({
  answer,
  step,
}: Grade<"check"> & { step: PlayableTeachingStepOf<"check"> }): GradedStepAnswer | null {
  const option = step.content.options.find((item) => item.id === answer.optionId);
  const correct = step.content.options.find((item) => item.isCorrect);

  if (!option) {
    return null;
  }

  return {
    answerText: option.text,
    correctAnswer: option.isCorrect ? null : (correct?.text ?? null),
    feedback: option.reason,
    isCorrect: option.isCorrect,
  };
}

function gradeActivityChoice({
  answer,
  step,
}: Grade<"activity"> & { step: PlayableTeachingStepOf<"activity"> }): GradedStepAnswer | null {
  const { check } = step.content;

  if (check.kind !== "choice" || answer.answer.kind !== "choice") {
    return null;
  }

  const { optionId } = answer.answer;
  const option = check.options.find((item) => item.id === optionId);
  const correct = check.options.find((item) => item.isCorrect);

  if (!option) {
    return null;
  }

  return {
    answerText: option.text,
    correctAnswer: option.isCorrect ? null : (correct?.text ?? null),
    feedback: option.reason,
    isCorrect: option.isCorrect,
  };
}

function formatNumber(value: number, unit: string | undefined): string {
  return unit ? `${value} ${unit}` : String(value);
}

/**
 * The engine computes the right end state of every activity, so the player and the server share
 * one verdict. A choice answers with an option, a numeric check with a number, and an interaction
 * with its end state.
 */
function gradeActivity({
  answer,
  step,
}: Grade<"activity"> & { step: PlayableTeachingStepOf<"activity"> }): GradedStepAnswer | null {
  const { check } = step.content;

  if (check.kind === "choice") {
    return gradeActivityChoice({ answer, step });
  }

  if (check.kind === "numeric" && answer.answer.kind !== "numeric") {
    return null;
  }

  const isCorrect = checkActivityAnswer(step.content, answer.answer);
  const expected = check.kind === "numeric" ? formatNumber(check.answer, check.unit) : null;

  return {
    answerText:
      answer.answer.kind === "numeric" && check.kind === "numeric"
        ? formatNumber(answer.answer.value, check.unit)
        : null,
    correctAnswer: isCorrect ? null : expected,
    feedback: check.explanation,
    isCorrect,
  };
}

/**
 * A challenge is graded by its path: the ending it reached, and right when at least half of its
 * decisions were good. Every path ends, so the learner always finishes the case.
 */
function gradeChallenge({
  answer,
  step,
}: Grade<"challenge"> & { step: PlayableTeachingStepOf<"challenge"> }): GradedStepAnswer | null {
  const result = gradeChallengePath(step.content, answer.choiceIds);

  if (!result) {
    return null;
  }

  return {
    answerText: result.steps.map((item) => item.choice.text).join(" → "),
    correctAnswer: null,
    feedback: result.ending.outcome,
    isCorrect: result.isCorrect,
  };
}

function findOptionText(
  options: readonly { id: string; text?: string; prompt?: string }[],
  optionId: string,
): string | null {
  const option = options.find((item) => item.id === optionId);
  return option?.text ?? option?.prompt ?? null;
}

/** How a language exercise answer reads as text in the mistakes notebook. */
function describeExerciseAnswer({
  answer,
  exercise,
}: {
  answer: SelectedAnswer;
  exercise: SerializedStep;
}): string | null {
  switch (answer.kind) {
    case "multipleChoice":
      return "options" in exercise.content
        ? findOptionText(exercise.content.options, answer.selectedOptionId)
        : null;
    case "fillBlank":
      return answer.userAnswers.join(", ");
    case "matchColumns":
      return answer.userPairs.map((pair) => `${pair.left} → ${pair.right}`).join("; ");
    case "translation":
      return (
        exercise.translationOptions.find((option) => option.id === answer.selectedOptionId)?.word ??
        null
      );
    case "reading":
    case "listening":
      return answer.arrangedWords.join(" ");
    default:
      return null;
  }
}

function isExerciseAnswer(answer: LessonStepAnswer): answer is SelectedAnswer & LessonStepAnswer {
  return !["activity", "challenge", "check", "spokenAnswer", "typedAnswer"].includes(answer.kind);
}

/** Language exercises keep today's check code, so a screen grades the same as it does today. */
function gradeExercise({
  answer,
  step,
}: {
  answer: LessonStepAnswer;
  step: PlayableLanguageStep;
}): GradedStepAnswer | null {
  if (!isExerciseAnswer(answer)) {
    return null;
  }

  const result = checkStepAnswer(step.exercise, answer);

  if (!result) {
    return null;
  }

  return {
    answerText: describeExerciseAnswer({ answer, exercise: step.exercise }),
    correctAnswer: result.isCorrect ? null : result.correctAnswer,
    feedback: result.feedback,
    isCorrect: result.isCorrect,
  };
}

/** "I can't talk now": a spoken screen answered as its listening exercise grades like one. */
function toListeningStep({
  listening,
  step,
}: {
  listening: SerializedStep;
  step: PlayableSpokenAnswerStep;
}): PlayableLanguageStep {
  return {
    exercise: listening,
    id: step.id,
    kind: "listening",
    position: step.position,
    skillId: step.skillId,
    wordHints: null,
  };
}

/**
 * Grades the answers code can settle from a screen's content: checks, activities and language
 * exercises. The player grades on the device for instant feedback and the server grades again
 * from the stored step with this same function, so they can't disagree. A spoken screen answered
 * as its listening exercise ("I can't talk now") grades like that exercise. Returns null for an
 * answer that doesn't fit the screen and for typed or spoken answers, which only the server grades.
 */
export function gradeStepAnswer({
  answer,
  step,
}: {
  answer: LessonStepAnswer;
  step: PlayableLibraryStep;
}): GradedStepAnswer | null {
  if (step.kind === "check") {
    return answer.kind === "check" ? gradeCheck({ answer, step }) : null;
  }

  if (step.kind === "activity") {
    return answer.kind === "activity" ? gradeActivity({ answer, step }) : null;
  }

  if (step.kind === "challenge") {
    return answer.kind === "challenge" ? gradeChallenge({ answer, step }) : null;
  }

  if (step.kind === "spokenAnswer") {
    return step.listening
      ? gradeExercise({ answer, step: toListeningStep({ listening: step.listening, step }) })
      : null;
  }

  if ("exercise" in step) {
    return gradeExercise({ answer, step });
  }

  return null;
}

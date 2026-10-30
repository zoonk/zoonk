import { exactFractionDigitsFor } from "@zoonk/utils/localized-number";
import { formatMathAnswer } from "@zoonk/utils/math-answer";
import { checkActivityAnswer } from "../library/activities/activity-answers";
import { getActivityExpected } from "../library/activities/activity-expected";
import { type ActivityExpected } from "../library/activities/activity-expected-answer";
import { gradeChallengePath } from "../library/challenges/challenge-run";
import { type SelectedAnswer } from "../player/contracts/_utils/selected-answer-schema";
import { checkStepAnswer } from "../player/contracts/check-step-answer";
import { type SerializedStep } from "../player/contracts/prepare-lesson-data";
import { type LessonStepAnswer } from "./contract";
import {
  type PlayableLanguageStep,
  type PlayableLibraryStep,
  type PlayableSpokenAnswerStep,
  type PlayableTeachingStepOf,
} from "./playable-lesson";

export type GradedStepAnswer = {
  answerText: string | null;
  /** The right answer as text when the learner missed it. */
  correctAnswer: string | null;
  /** An activity's correct end state, drawn next to the learner's answer; null for other screens. */
  expected: ActivityExpected | null;
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
    expected: null,
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
    expected: getActivityExpected(step.content),
    feedback: option.reason,
    isCorrect: option.isCorrect,
  };
}

function gradeActivity({
  answer,
  language,
  step,
}: Grade<"activity"> & {
  language: string;
  step: PlayableTeachingStepOf<"activity">;
}): GradedStepAnswer | null {
  const { check } = step.content;

  if (check.kind === "choice") {
    return gradeActivityChoice({ answer, step });
  }

  if (check.kind === "numeric" && answer.answer.kind !== "numeric") {
    return null;
  }

  const isCorrect = checkActivityAnswer(step.content, answer.answer);
  const unit = check.kind === "numeric" ? (check.unit ?? null) : null;

  const maximumFractionDigits =
    check.kind === "numeric"
      ? exactFractionDigitsFor({
          expected: check.answer,
          tolerance: check.tolerance,
          value: answer.answer.kind === "numeric" ? answer.answer.value : undefined,
        })
      : undefined;

  const exact = (value: number) =>
    formatMathAnswer({ language, maximumFractionDigits, unit, value });

  const expected = check.kind === "numeric" ? exact(check.answer) : null;

  return {
    answerText:
      answer.answer.kind === "numeric" && check.kind === "numeric"
        ? exact(answer.answer.value)
        : null,
    correctAnswer: isCorrect ? null : expected,
    expected: getActivityExpected(step.content),
    feedback: check.explanation,
    isCorrect,
  };
}

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
    expected: null,
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
    expected: null,
    feedback: result.feedback,
    isCorrect: result.isCorrect,
  };
}

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

/** Returns null for mismatched answers and for typed/spoken answers requiring server grading. */
export function gradeStepAnswer({
  answer,
  language,
  step,
}: {
  answer: LessonStepAnswer;
  /** The lesson's language, which writes a number's unit in the answers' text. */
  language: string;
  step: PlayableLibraryStep;
}): GradedStepAnswer | null {
  if (step.kind === "check") {
    return answer.kind === "check" ? gradeCheck({ answer, step }) : null;
  }

  if (step.kind === "activity") {
    return answer.kind === "activity" ? gradeActivity({ answer, language, step }) : null;
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

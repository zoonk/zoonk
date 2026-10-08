"use client";

import { AlphabetStep } from "../../components/alphabet-step";
import { FillBlankStep } from "../../components/fill-blank-step";
import { ListeningStep } from "../../components/listening-step";
import { MatchColumnsStep } from "../../components/match-columns-step";
import { MultipleChoiceStep } from "../../components/multiple-choice-step";
import { ReadingStep } from "../../components/reading-step";
import { TranslationStep } from "../../components/translation-step";
import { VocabularyStep } from "../../components/vocabulary-step";
import { type SelectedAnswer, type StepResult } from "../../step-answer";
import { type LessonPlayerAnswer, type PlayableLanguageStep } from "../lesson-player-types";
import { type LessonStepViewProps } from "./lesson-step-view-props";
import { WordHints } from "./word-hints";

const EXERCISE_ANSWER_KINDS = new Set<string>([
  "fillBlank",
  "listening",
  "matchColumns",
  "multipleChoice",
  "reading",
  "translation",
]);

function isExerciseAnswer(
  answer: LessonPlayerAnswer,
): answer is LessonPlayerAnswer & SelectedAnswer {
  return EXERCISE_ANSWER_KINDS.has(answer.kind);
}

function toSelectedAnswer(answer: LessonPlayerAnswer | undefined): SelectedAnswer | undefined {
  return answer && isExerciseAnswer(answer) ? answer : undefined;
}

/**
 * Language exercises play through the exercise components in `src/components`, with their own
 * answers and inline feedback.
 */
export function ExerciseStepView({
  answer,
  isLocked,
  onAnswer,
  result,
  step,
}: LessonStepViewProps<PlayableLanguageStep>) {
  const { exercise } = step;
  const selectedAnswer = toSelectedAnswer(answer);

  const stepResult: StepResult | undefined = result
    ? {
        answer: selectedAnswer,
        result: {
          correctAnswer: result.correctAnswer,
          feedback: result.feedback,
          isCorrect: result.isCorrect,
        },
      }
    : undefined;

  function handleSelect(value: SelectedAnswer | null) {
    if (!isLocked) {
      onAnswer(value);
    }
  }

  const shared = { onSelectAnswer: handleSelect, selectedAnswer, step: exercise };

  switch (step.kind) {
    case "alphabet":
      return <AlphabetStep step={exercise} />;
    case "vocabulary":
      return (
        <VocabularyStep step={exercise}>
          {step.wordHints && <WordHints hints={step.wordHints} />}
        </VocabularyStep>
      );
    case "fillBlank":
      return <FillBlankStep {...shared} result={stepResult} />;
    case "listening":
      return <ListeningStep {...shared} result={stepResult} />;
    case "matchColumns":
      return <MatchColumnsStep {...shared} />;
    case "multipleChoice":
      return <MultipleChoiceStep {...shared} />;
    case "reading":
      return <ReadingStep {...shared} result={stepResult} />;
    case "translation":
      return <TranslationStep {...shared} />;
    default:
      return null;
  }
}

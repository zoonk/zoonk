import "server-only";
import { type LessonQuestionContextSnapshot } from "@zoonk/ai/tasks/lessons/question";
import { checkStepAnswer } from "../../player/contracts/check-step-answer";
import { type SelectedAnswer } from "../../player/contracts/completion-input-schema";
import { type LessonQuestionStep } from "./question-step";
import { getSelectedAnswer } from "./selected-answer-context";

export async function getLessonQuestionAnswer({
  answer,
  step,
}: {
  answer: SelectedAnswer;
  step: LessonQuestionStep;
}): Promise<NonNullable<LessonQuestionContextSnapshot["answer"]> | "invalid"> {
  const result = checkStepAnswer(
    {
      content: step.content,
      kind: step.kind,
      sentence: step.sentence
        ? {
            explanation: step.chapterSentence?.explanation,
            sentence: step.sentence.sentence,
            translation: step.chapterSentence?.translation ?? "",
          }
        : null,
      word: step.word ? { id: step.word.id, word: step.word.word } : null,
    },
    answer,
  );

  if (!result) {
    return "invalid";
  }

  const selectedAnswer = await getSelectedAnswer({ answer, step });

  if (!selectedAnswer) {
    return "invalid";
  }

  return {
    correctAnswer: result.correctAnswer,
    feedback: result.feedback,
    isCorrect: result.isCorrect,
    selectedAnswer,
  };
}

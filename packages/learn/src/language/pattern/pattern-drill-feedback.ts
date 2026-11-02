import { type MistakePatternView } from "@zoonk/core/language/patterns/contract";
import { type ChoiceFeedback } from "../../questions/choice-question";

export type DrillQuestion = MistakePatternView["drill"][number];

function isSameAnswer(chosen: string, answer: string): boolean {
  return chosen.trim() === answer.trim();
}

export function toDrillFeedback({
  answer,
  question,
}: {
  answer: string | null;
  question: DrillQuestion;
}): ChoiceFeedback | null {
  if (answer === null) {
    return null;
  }

  return {
    correctAnswer: {
      selectedIndex: question.options.findIndex((option) => isSameAnswer(option, question.answer)),
    },
    explanation: question.feedback,
    isCorrect: isSameAnswer(answer, question.answer),
  };
}

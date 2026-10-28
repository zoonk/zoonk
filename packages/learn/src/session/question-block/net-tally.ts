import { type StudyQuestion } from "../session-types";
import { type QuestionBlockState } from "./question-block-state";

type NetTally = { blank: number; right: number; wrong: number };

/** This visit's answers, else the block's record of an earlier visit, so after a reload a blank still counts as neither. */
export function getNetTally({
  answers,
  questions,
}: {
  answers: QuestionBlockState["answers"];
  questions: readonly Pick<StudyQuestion, "answered" | "itemId">[];
}): NetTally {
  const graded = questions.flatMap((question) => {
    const answer = answers[question.itemId] ?? question.answered;
    return answer ? [answer] : [];
  });

  const right = graded.filter((answer) => answer.isCorrect).length;
  const blank = graded.filter((answer) => !answer.isCorrect && answer.blank).length;

  return { blank, right, wrong: graded.length - right - blank };
}

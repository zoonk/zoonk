import "server-only";
import { gradeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { canGradeWithModel } from "./model-grading";
import { type TypedItem, getTypedQuestionText, matchesAcceptedAnswer } from "./typed-items";

/** A typed answer's verdict, with the model's feedback when a model graded it. */
export type TypedVerdict = { feedback: string | null; isCorrect: boolean };

/**
 * Grades a typed answer: code settles an accepted answer, and a fast model grades the rest (not
 * counted as small AI help: grading must stay right). An answer that shows the idea the question
 * checks counts as right even when it leaves out a detail, and an empty answer is wrong without
 * asking. Past the day's model-graded answers to one question (`canGradeWithModel`), only an
 * accepted answer counts.
 */
export async function gradeTypedItemAnswer({
  item,
  text,
  userId,
}: {
  item: TypedItem;
  text: string;
  userId: string;
}): Promise<TypedVerdict> {
  if (!text.trim()) {
    return { feedback: null, isCorrect: false };
  }

  if (!(await canGradeWithModel({ question: { itemId: item.id }, userId }))) {
    return { feedback: null, isCorrect: matchesAcceptedAnswer({ item, text }) };
  }

  const { content } = item;

  const { data } = await gradeTypedAnswer({
    acceptedAnswers: content.acceptedAnswers,
    analytics: { contentScope: "personal", distinctId: userId },
    answer: text,
    keyPoints: content.keyPoints,
    language: item.language,
    question: getTypedQuestionText(item),
    sampleAnswer: content.sampleAnswer,
  });

  return { feedback: data.feedback, isCorrect: data.isCorrect };
}

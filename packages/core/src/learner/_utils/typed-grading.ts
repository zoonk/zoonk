import "server-only";
import { gradeTypedAnswer } from "@zoonk/ai/tasks/v2/grading/grade-typed-answer";
import { canGradeWithModel } from "./model-grading";
import { type TypedItem, getTypedQuestionText, matchesAcceptedAnswer } from "./typed-items";

export type TypedVerdict = { feedback: string | null; isCorrect: boolean };

/** May call a model, without claiming small AI help; after its daily per-question cap only accepted answers count. */
export async function gradeTypedItemAnswer({
  item,
  practicedLanguage,
  text,
  userId,
}: {
  item: TypedItem;
  practicedLanguage: string | null;
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
    practicedLanguage,
    question: getTypedQuestionText(item),
    sampleAnswer: content.sampleAnswer,
  });

  return { feedback: data.feedback, isCorrect: data.isCorrect };
}

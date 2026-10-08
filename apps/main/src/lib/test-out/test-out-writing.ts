import { type QuestionWriting, requestQuestionWriting } from "@/lib/questions/question-writing";

/** Asks the API for the questions a chapter's test-out still needs (see `requestQuestionWriting`). */
export function requestTestOutWriting({
  chapterId,
  goalId,
}: {
  chapterId: string;
  goalId: string;
}): Promise<QuestionWriting> {
  return requestQuestionWriting(
    `/goals/${encodeURIComponent(goalId)}/chapters/${encodeURIComponent(chapterId)}/test-out/generations`,
  );
}

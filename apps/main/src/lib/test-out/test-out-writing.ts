import { type QuestionWriting, requestQuestionWriting } from "@/lib/questions/question-writing";

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

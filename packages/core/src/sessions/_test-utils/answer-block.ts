import { answerStudyQuestion } from "../answer-study-question";
import { type StudyAnswerResult } from "../contract";
import { getStudyBlock } from "../get-study-block";

/** Answers sequentially to preserve scoring order; option zero is correct in session fixtures. */
export async function answerBlockInOrder({
  blockId,
  count,
  optionIndex = 0,
  sessionId,
}: {
  blockId: string;
  count?: number;
  optionIndex?: number;
  sessionId: string;
}): Promise<StudyAnswerResult[]> {
  const detail = await getStudyBlock({ blockId, sessionId });

  if (detail.status !== "ready") {
    throw new Error("Expected the block's questions");
  }

  return detail.detail.questions
    .slice(0, count)
    .reduce<Promise<StudyAnswerResult[]>>(async (previous, question) => {
      const results = await previous;

      const result = await answerStudyQuestion({
        blockId,
        input: {
          answer: { selectedIndex: optionIndex },
          durationMs: 4000,
          itemId: question.itemId,
        },
        sessionId,
      });

      return [...results, result];
    }, Promise.resolve([]));
}

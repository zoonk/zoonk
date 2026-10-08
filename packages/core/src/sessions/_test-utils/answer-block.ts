import { answerStudyQuestion } from "../answer-study-question";
import { type StudyAnswerResult } from "../contract";
import { getStudyBlock } from "../get-study-block";

/**
 * Answers every question of a block with the same option, one after another like a learner does,
 * so Hyperdrive and the notebook see them in order. Option 0 is right in the session fixtures.
 */
export async function answerBlockInOrder({
  blockId,
  optionIndex = 0,
  sessionId,
}: {
  blockId: string;
  optionIndex?: number;
  sessionId: string;
}): Promise<StudyAnswerResult[]> {
  const detail = await getStudyBlock({ blockId, sessionId });

  if (detail.status !== "ready") {
    throw new Error("Expected the block's questions");
  }

  return detail.detail.questions.reduce<Promise<StudyAnswerResult[]>>(
    async (previous, question) => {
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
    },
    Promise.resolve([]),
  );
}

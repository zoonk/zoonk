import "server-only";
import { type MistakeCause, prisma } from "@zoonk/db";
import { gradeChoiceAnswer } from "../../../learner/_utils/choice-items";
import { itemAnswerInputSchema } from "../../../learner/contract";
import { type MockConditions, type MockReviewEntry } from "../mock-contract";
import { type MockItem, loadMockItems } from "./mock-items";
import { getAskedItemIds } from "./mock-sections";

const BLANK = { dontKnow: true } as const;

function toEntry({
  answer,
  area,
  item,
  number,
}: {
  answer: unknown;
  area: string | null;
  item: MockItem;
  number: number;
}): MockReviewEntry | null {
  const parsed = itemAnswerInputSchema.shape.answer.safeParse(answer);
  const choice = parsed.success ? parsed.data : BLANK;
  const graded = gradeChoiceAnswer({ answer: choice, item });

  if (graded.isCorrect) {
    return null;
  }

  return {
    area,
    citation: item.citation,
    correctAnswer: graded.snapshot.correctAnswer ?? null,
    explanation: graded.snapshot.explanation ?? null,
    format: item.format,
    itemId: item.id,
    learnerAnswer: graded.snapshot.answer,
    number,
    outcome: "dontKnow" in choice ? "blank" : "wrong",
    question: graded.snapshot.question,
  };
}

type FinishedMockAnswers = {
  attempts: { answer: unknown; id: string; itemId: string | null }[];
  items: Map<string, MockItem>;
};

/** The mock's graded answers, as they were recorded when it finished. */
async function loadFinishedAnswers({
  conditions,
  mockExamId,
  userId,
}: {
  conditions: MockConditions;
  mockExamId: string;
  userId: string;
}): Promise<FinishedMockAnswers> {
  const itemIds = getAskedItemIds(conditions).map((entry) => entry.itemId);

  const [attempts, items] = await Promise.all([
    prisma.attempt.findMany({
      select: { answer: true, id: true, itemId: true },
      where: { itemId: { in: itemIds }, mockExamId, userId },
    }),
    loadMockItems(itemIds),
  ]);

  return { attempts, items };
}

/**
 * After a mock: every question missed or left blank with the right answer and why, in the mock's
 * order, and the notebook's causes for the mistakes (filled in as the classifier gets to them).
 */
export async function loadMockReview({
  areas,
  conditions,
  mockExamId,
  userId,
}: {
  areas: Map<string, string>;
  conditions: MockConditions;
  mockExamId: string;
  userId: string;
}): Promise<{
  mistakes: { cause: MistakeCause | null; count: number }[];
  review: MockReviewEntry[];
}> {
  const { attempts, items } = await loadFinishedAnswers({ conditions, mockExamId, userId });

  const review = getAskedItemIds(conditions).flatMap((entry, index) => {
    const item = items.get(entry.itemId);
    const attempt = attempts.find((row) => row.itemId === entry.itemId);

    if (!item || !attempt) {
      return [];
    }

    const reviewed = toEntry({
      answer: attempt.answer,
      area: areas.get(item.skillId) ?? null,
      item,
      number: index + 1,
    });

    return reviewed ? [reviewed] : [];
  });

  const mistakes = await prisma.mistake.findMany({
    select: { cause: true },
    where: { attemptId: { in: attempts.map((attempt) => attempt.id) }, userId },
  });

  const causes = [...new Set(mistakes.map((mistake) => mistake.cause))];

  return {
    mistakes: causes.map((cause) => ({
      cause,
      count: mistakes.filter((mistake) => mistake.cause === cause).length,
    })),
    review,
  };
}

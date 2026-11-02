import "server-only";
import { type MistakeCause, prisma } from "@zoonk/db";
import { getPickOutcome } from "../../scoring/partial-credit";
import { type MockConditions } from "../mock-contract";
import { type MockReviewEntry } from "../mock-view-contract";
import { gradeMockItem, readRecordedMockAnswer } from "./mock-item-grading";
import { type MockItem, loadMockItems, toMockQuestionView } from "./mock-items";
import { getAskedItemIds } from "./mock-sections";

function toEntry({
  area,
  attempt,
  conditions,
  item,
  mockExamId,
  number,
}: {
  area: string | null;
  attempt: { answer: unknown; isCorrect: boolean };
  conditions: MockConditions;
  item: MockItem;
  mockExamId: string;
  number: number;
}): MockReviewEntry | null {
  if (attempt.isCorrect) {
    return null;
  }

  const grade = gradeMockItem({
    answer: readRecordedMockAnswer(attempt.answer),
    item,
    mockId: mockExamId,
    partialCredit: conditions.partialCredit,
  });

  const outcome = getPickOutcome({ answered: grade.answered, credit: grade.credit });
  const shown = toMockQuestionView({ item, mockId: mockExamId });

  return {
    area,
    citation: item.citation,
    context: shown.context,
    correctAnswer: grade.snapshot.correctAnswer ?? null,
    explanation: grade.snapshot.explanation ?? null,
    format: item.format,
    itemId: item.id,
    learnerAnswer: grade.snapshot.answer,
    number,
    outcome: outcome === "blank" || outcome === "partial" ? outcome : "wrong",
    question: shown.question,
    set: shown.set,
  };
}

type FinishedMockAnswers = {
  attempts: { answer: unknown; id: string; isCorrect: boolean; itemId: string | null }[];
  items: Map<string, MockItem>;
};

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
      select: { answer: true, id: true, isCorrect: true, itemId: true },
      where: { itemId: { in: itemIds }, mockExamId, userId },
    }),
    loadMockItems(itemIds, { reveal: true }),
  ]);

  return { attempts, items };
}

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
      area: areas.get(item.skillId) ?? null,
      attempt,
      conditions,
      item,
      mockExamId,
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

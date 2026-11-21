import "server-only";
import { type MistakeCause, prisma } from "@zoonk/db";
import { isStillAsked } from "../../../library/items/item-image";
import { getPickOutcome } from "../../scoring/partial-credit";
import { type MockConditions } from "../mock-contract";
import { type MockReviewEntry } from "../mock-view-contract";
import { gradeMockItem, readRecordedMockAnswer } from "./mock-item-grading";
import { type MockItem, loadMockItems, toMockQuestionView } from "./mock-items";
import { getAskedItemIds, numberMockQuestions } from "./mock-sections";

function toEntry({
  area,
  attempt,
  conditions,
  item,
  mockExamId,
  number,
  section,
  total,
}: {
  area: string | null;
  attempt: { answer: unknown; isCorrect: boolean };
  conditions: MockConditions;
  item: MockItem;
  mockExamId: string;
  number: number;
  section: number;
  total: number;
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
    section,
    set: shown.set,
    total,
  };
}

type FinishedMockAnswers = {
  attempts: { answer: unknown; id: string; isCorrect: boolean; itemId: string | null }[];
  items: Map<string, MockItem>;
};

async function loadFinishedAnswers({
  itemIds,
  mockExamId,
  userId,
}: {
  itemIds: string[];
  mockExamId: string;
  userId: string;
}): Promise<FinishedMockAnswers> {
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
  const asked = getAskedItemIds(conditions);

  const { attempts, items } = await loadFinishedAnswers({
    itemIds: asked.map((entry) => entry.itemId),
    mockExamId,
    userId,
  });

  const attemptsByItem = new Map(attempts.map((attempt) => [attempt.itemId, attempt]));
  const bySection = Map.groupBy(asked, (entry) => entry.section);

  const review = [...bySection].flatMap(([section, entries]) => {
    const satQuestions = entries.filter(({ itemId }) => {
      const item = items.get(itemId);

      // Placement doesn't record attempts for blanks, which still occupied a slot in the running paper.
      return (
        attemptsByItem.has(itemId) ||
        (conditions.purpose === "placement" && item && isStillAsked({ answered: false, item }))
      );
    });

    return numberMockQuestions(satQuestions).flatMap(({ number, question, total }) => {
      const item = items.get(question.itemId);
      const attempt = attemptsByItem.get(question.itemId);

      if (!item || !attempt) {
        return [];
      }

      const reviewed = toEntry({
        area: areas.get(item.skillId) ?? null,
        attempt,
        conditions,
        item,
        mockExamId,
        number,
        section,
        total,
      });

      return reviewed ? [reviewed] : [];
    });
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

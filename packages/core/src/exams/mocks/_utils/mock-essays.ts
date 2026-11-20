import "server-only";
import { type Goal, type Item, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type EssayContent, readEssayContent } from "../../essays/_utils/essay-content";
import { essayAnswerSchema } from "../../essays/essay-contract";
import {
  writingPromptSchema,
  writtenAnswerSchema,
  writtenItemSchema,
} from "../../essays/writing-contract";
import { isNumericWritingRubric } from "../../essays/writing-rubric-policy";
import { loadUnseenWritingPrompts } from "../../essays/writing-supply";
import { type MockEssayView } from "../mock-view-contract";
import { type MockEssayCandidate } from "../written-parts";
import { readMockEssayText } from "./mock-answers";
import { getEssayItemIds } from "./mock-sections";
import { type MockSitting } from "./owned-mock";

export async function loadMockEssays({
  goal,
  userId,
}: {
  goal: Pick<Goal, "examBlueprintId" | "id">;
  userId: string;
}): Promise<MockEssayCandidate[]> {
  if (!goal.examBlueprintId) {
    return [];
  }

  const bank = await loadUnseenWritingPrompts({ goalId: goal.id, tx: prisma, userId });

  return bank
    .filter(({ writing }) => writing.unit === "answer")
    .map(({ id, writing }) => ({ itemId: id, taskKey: writing.taskKey }));
}

export function readMockWriting(item: Pick<Item, "content">) {
  return writtenItemSchema.safeParse(isJsonObject(item.content) ? item.content.writing : null).data;
}

export type MockEssayItem = { content: EssayContent; item: Item };

export async function loadMockEssayItems(
  itemIds: readonly string[],
): Promise<Map<string, MockEssayItem>> {
  if (itemIds.length === 0) {
    return new Map();
  }

  const items = await prisma.item.findMany({ where: { id: { in: [...itemIds] } } });

  return new Map(
    items.flatMap((item) => {
      const content = readEssayContent(item);
      return content ? [[item.id, { content, item }] as const] : [];
    }),
  );
}

export async function loadMockEssayViews({
  areas,
  mock,
}: {
  areas: Map<string, string>;
  mock: MockSitting;
}): Promise<{ numericBlankItems: ReadonlySet<string>; views: MockEssayView[] }> {
  const itemIds = getEssayItemIds(mock.conditions);

  if (itemIds.length === 0) {
    return { numericBlankItems: new Set(), views: [] };
  }

  const [items, attempts] = await Promise.all([
    loadMockEssayItems(itemIds),
    prisma.attempt.findMany({
      select: { answer: true, itemId: true },
      where: { itemId: { in: itemIds }, mockExamId: mock.id },
    }),
  ]);

  const numericBlankItems = new Set<string>();

  const views = itemIds.flatMap((itemId): MockEssayView[] => {
    const essay = items.get(itemId);

    if (!essay) {
      return [];
    }

    const draft = mock.answers.find((answer) => answer.itemId === itemId);
    const text = readMockEssayText(draft?.answer);
    const recorded = attempts.find((attempt) => attempt.itemId === itemId);

    const grade =
      writtenAnswerSchema.safeParse(recorded?.answer).data?.grade ??
      essayAnswerSchema.safeParse(recorded?.answer).data?.grade ??
      null;

    const basis = readMockWriting(essay.item);
    const writing = writingPromptSchema.safeParse(basis).data;

    if (!text && basis && isNumericWritingRubric(basis)) {
      numericBlankItems.add(itemId);
    }

    return [
      {
        area: areas.get(essay.item.skillId) ?? null,
        context: essay.content.context,
        grade,
        itemId,
        question: essay.content.question,
        status: getEssayStatus({ grade, text }),
        text,
        ...(writing && { writing }),
      },
    ];
  });

  return { numericBlankItems, views };
}

function getEssayStatus({
  grade,
  text,
}: {
  grade: MockEssayView["grade"];
  text: string | null;
}): MockEssayView["status"] {
  if (grade) {
    return "graded";
  }

  return text ? "pending" : "blank";
}

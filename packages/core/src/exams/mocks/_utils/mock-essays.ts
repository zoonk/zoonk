import "server-only";
import { type Goal, type Item, prisma } from "@zoonk/db";
import { type EssayContent, readEssayContent } from "../../essays/_utils/essay-content";
import { getWritingAttemptId } from "../../essays/_utils/writing-attempt-id";
import { writingPromptSchema, writtenAnswerSchema } from "../../essays/writing-contract";
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

  const admissionId = mock.conditions.writingAdmissionId;

  const attempts = admissionId
    ? await prisma.attempt.findMany({
        select: { answer: true },
        where: {
          id: { in: itemIds.map((itemId) => getWritingAttemptId({ admissionId, itemId })) },
          mockExamId: mock.id,
          userId: mock.userId,
        },
      })
    : [];

  const graded = new Map(
    attempts.flatMap(({ answer }) => {
      const saved = writtenAnswerSchema.safeParse(answer).data;
      return saved?.mockPrompt ? [[saved.itemId, saved] as const] : [];
    }),
  );

  const items = await loadMockEssayItems(itemIds.filter((itemId) => !graded.has(itemId)));

  const numericBlankItems = new Set<string>();

  const views = itemIds.flatMap((itemId): MockEssayView[] => {
    const draft = mock.answers.find((answer) => answer.itemId === itemId);
    const saved = graded.get(itemId);

    if (saved?.mockPrompt) {
      return [
        {
          ...saved.mockPrompt,
          grade: saved.grade,
          itemId,
          status: "graded",
          text: saved.text,
          unsure: draft?.flagged ?? false,
          writing: writingPromptSchema.parse(saved.writing),
        },
      ];
    }

    const essay = items.get(itemId);

    if (!essay) {
      return [];
    }

    const text = readMockEssayText(draft?.answer);
    const basis = essay.content.writing;
    const writing = writingPromptSchema.parse(basis);

    if (!text && isNumericWritingRubric(basis)) {
      numericBlankItems.add(itemId);
    }

    return [
      {
        area: areas.get(essay.item.skillId) ?? null,
        context: essay.content.context,
        grade: null,
        itemId,
        question: essay.content.question,
        status: text ? "pending" : "blank",
        text,
        unsure: draft?.flagged ?? false,
        writing,
      },
    ];
  });

  return { numericBlankItems, views };
}

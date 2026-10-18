import "server-only";
import { type Goal, type Item, prisma } from "@zoonk/db";
import { type EssayContent, readEssayContent } from "../../essays/_utils/essay-content";
import { essayAnswerSchema } from "../../essays/essay-contract";
import { type MockEssayView } from "../mock-view-contract";
import { type MockEssayCandidate } from "../written-parts";
import { readMockEssayText } from "./mock-answers";
import { loadSkillAreas } from "./mock-candidates";
import { getEssayItemIds } from "./mock-sections";
import { type MockSitting } from "./owned-mock";

/**
 * The exam's own essay questions (`format: essay`), which a full mock's written parts ask, each
 * under its plan area: the ones the learner never wrote first, then the one they wrote longest
 * ago. None for a goal without an exam.
 */
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

  const [items, areas] = await Promise.all([
    prisma.item.findMany({
      omit: { content: true },
      orderBy: { id: "asc" },
      where: { examBlueprintId: goal.examBlueprintId, format: "essay" },
    }),
    loadSkillAreas(goal.id),
  ]);

  const written = await prisma.attempt.groupBy({
    _max: { answeredAt: true },
    by: ["itemId"],
    where: { itemId: { in: items.map((item) => item.id) }, userId },
  });

  const lastWritten = new Map(
    written.flatMap((row) =>
      row.itemId && row._max.answeredAt
        ? [[row.itemId, row._max.answeredAt.getTime()] as const]
        : [],
    ),
  );

  return items
    .toSorted(
      (first, second) => (lastWritten.get(first.id) ?? 0) - (lastWritten.get(second.id) ?? 0),
    )
    .map((item) => ({ area: areas.get(item.skillId) ?? null, itemId: item.id }));
}

/** A full mock's essay question with its prompt and rubric. */
export type MockEssayItem = { content: EssayContent; item: Item };

/** The mock's essay questions by id; an item that is no longer an essay is left out. */
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

/**
 * A finished mock's essays: each one's text from its draft and its grade from the attempt grading
 * recorded, `pending` while a written one has none yet.
 */
export async function loadMockEssayViews({
  areas,
  mock,
}: {
  areas: Map<string, string>;
  mock: MockSitting;
}): Promise<MockEssayView[]> {
  const itemIds = getEssayItemIds(mock.conditions);

  if (itemIds.length === 0) {
    return [];
  }

  const [items, attempts] = await Promise.all([
    loadMockEssayItems(itemIds),
    prisma.attempt.findMany({
      select: { answer: true, itemId: true },
      where: { itemId: { in: itemIds }, mockExamId: mock.id },
    }),
  ]);

  return itemIds.flatMap((itemId): MockEssayView[] => {
    const essay = items.get(itemId);

    if (!essay) {
      return [];
    }

    const draft = mock.answers.find((answer) => answer.itemId === itemId);
    const text = readMockEssayText(draft?.answer);
    const recorded = attempts.find((attempt) => attempt.itemId === itemId);
    const grade = essayAnswerSchema.safeParse(recorded?.answer).data?.grade ?? null;

    return [
      {
        area: areas.get(essay.item.skillId) ?? null,
        context: essay.content.context,
        grade,
        itemId,
        question: essay.content.question,
        status: getEssayStatus({ grade, text }),
        text,
      },
    ];
  });
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

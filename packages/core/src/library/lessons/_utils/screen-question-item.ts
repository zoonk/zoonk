import "server-only";
import { isDeepStrictEqual } from "node:util";
import { GENERATED_ITEM_SCHEMAS, type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { type TransactionClient } from "@zoonk/db";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";
import { lockPlanSourceWrite } from "../../_utils/plan-input-write";
import { toStoredItem } from "../../items/item-content";
import { type ScreenMathItem } from "../../steps/written-screens";
import { CURRENT_STEPS } from "../lesson-versions";

type ScreenQuestion = Extract<GeneratedItem, { format: "numeric" }>;

type QuestionScreen = {
  provenance: LibraryProvenance;
  question: ScreenQuestion | null;
  skillId: string | null;
};

type AskedItem = { content: unknown; id: string; skillId: string };

export function toScreenQuestion(mathItem: ScreenMathItem | null): ScreenQuestion | null {
  return mathItem && { ...mathItem, difficulty: "medium", format: "numeric", otherSolutions: [] };
}

export function parseScreenQuestion(stored: unknown): ScreenQuestion | null {
  return GENERATED_ITEM_SCHEMAS.numeric.nullable().parse(stored);
}

function findAskedItem({
  asked,
  screen,
}: {
  asked: readonly AskedItem[];
  screen: QuestionScreen;
}): AskedItem | undefined {
  if (!screen.question || !screen.skillId) {
    return undefined;
  }

  // oxlint-disable-next-line unicorn/prefer-structured-clone -- Compares as the column stores it: JSON drops undefined fields, which a clone keeps.
  const stored: unknown = JSON.parse(JSON.stringify(toStoredItem(screen.question).content));

  return asked.find(
    (item) => item.skillId === screen.skillId && isDeepStrictEqual(item.content, stored),
  );
}

function matchAskedItems({
  asked,
  screens,
}: {
  asked: readonly AskedItem[];
  screens: readonly QuestionScreen[];
}): (string | null)[] {
  return screens.reduce<{ ids: (string | null)[]; left: readonly AskedItem[] }>(
    ({ ids, left }, screen) => {
      const match = findAskedItem({ asked: left, screen });
      return { ids: [...ids, match?.id ?? null], left: left.filter((item) => item !== match) };
    },
    { ids: [], left: asked },
  ).ids;
}

async function createQuestionItem(
  tx: TransactionClient,
  { language, screen }: { language: string; screen: QuestionScreen },
): Promise<string | null> {
  if (!screen.question || !screen.skillId) {
    return null;
  }

  const item = await tx.item.create({
    data: {
      ...toStoredItem(screen.question),
      language,
      skillId: screen.skillId,
      ...toProvenanceData(screen.provenance),
    },
  });

  return item.id;
}

/**
 * Adds each screen's question to the practice bank, read before the current version is retired.
 * A question it already asks keeps its item, so learners' answers and mistakes stay with it.
 */
export async function saveQuestionItems(
  tx: TransactionClient,
  {
    language,
    lessonId,
    screens,
  }: { language: string; lessonId: string; screens: readonly QuestionScreen[] },
): Promise<(string | null)[]> {
  const asked = await tx.item.findMany({
    select: { content: true, id: true, skillId: true },
    where: { steps: { some: { lessonId, ...CURRENT_STEPS } } },
  });

  const reused = matchAskedItems({ asked, screens });

  return Promise.all(
    screens.map(
      async (screen, index) => reused[index] ?? createQuestionItem(tx, { language, screen }),
    ),
  );
}

/**
 * A replaced question may have been wrong, so it leaves the practice bank once no current screen
 * of a lesson still taught asks it. Learners' mistakes keep their own snapshot of it.
 */
export async function dropUnaskedQuestions(tx: TransactionClient, lessonId: string): Promise<void> {
  const unasked = await tx.item.findMany({
    select: { id: true, skillId: true },
    where: {
      steps: { none: { ...CURRENT_STEPS, lesson: { setAsideAt: null } }, some: { lessonId } },
    },
  });

  if (unasked.length === 0) {
    return;
  }

  await lockPlanSourceWrite(tx, { skillIds: [...new Set(unasked.map(({ skillId }) => skillId))] });
  await tx.item.deleteMany({ where: { id: { in: unasked.map(({ id }) => id) } } });
}

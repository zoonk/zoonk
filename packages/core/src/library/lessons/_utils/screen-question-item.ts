import "server-only";
import { isDeepStrictEqual } from "node:util";
import { GENERATED_ITEM_SCHEMAS, type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { type Item, type TransactionClient } from "@zoonk/db";
import { z } from "zod";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";
import { normalizeItem, parseItemContent, toStoredItem } from "../../items/item-content";
import { isSecondTakeIdentityKey } from "../../second-takes/second-take-identity";
import { type ScreenMathItem } from "../../steps/written-screens";
import { CURRENT_STEPS } from "../lesson-versions";

export const screenQuestionSchema = z.discriminatedUnion("format", [
  GENERATED_ITEM_SCHEMAS.numeric,
  GENERATED_ITEM_SCHEMAS.multipleChoice,
]);

type ScreenQuestion = z.infer<typeof screenQuestionSchema>;

type QuestionScreen = {
  provenance: LibraryProvenance;
  question: ScreenQuestion | null;
  skillId: string | null;
};

type AskedItem = Pick<Item, "content" | "format" | "id" | "skillId">;

export function toScreenQuestion(
  mathItem: ScreenMathItem | null,
): Extract<GeneratedItem, { format: "numeric" }> | null {
  return mathItem && { ...mathItem, difficulty: "medium", format: "numeric", otherSolutions: [] };
}

export function parseScreenQuestion(stored: unknown): ScreenQuestion | null {
  return screenQuestionSchema.nullable().parse(stored);
}

type ChoiceItem = Extract<
  ReturnType<typeof parseItemContent>,
  { format: "multipleChoice" }
>["content"];

type ChoiceOption = ChoiceItem["options"][number];

function sameOptionKey(a: ChoiceOption, b: ChoiceOption): boolean {
  return a.text === b.text && a.isCorrect === b.isCorrect;
}

function orderToMatch(options: ChoiceOption[], previous: ChoiceOption[]): ChoiceOption[] {
  const left = [...options];

  return previous.flatMap((option) => {
    const index = left.findIndex((candidate) => sameOptionKey(candidate, option));
    return index === -1 ? [] : left.splice(index, 1);
  });
}

function matchChoice(previous: unknown, next: unknown): ChoiceItem | null {
  const before = parseItemContent({ content: previous, format: "multipleChoice" });
  const after = parseItemContent({ content: next, format: "multipleChoice" });

  if (before.format !== "multipleChoice" || after.format !== "multipleChoice") {
    return null;
  }

  const { options: previousOptions, ...stimulus } = before.content;
  const { options, ...nextStimulus } = after.content;

  if (!isDeepStrictEqual(stimulus, nextStimulus) || previousOptions.length !== options.length) {
    return null;
  }

  const ordered = orderToMatch(options, previousOptions);
  return ordered.length === options.length ? { ...after.content, options: ordered } : null;
}

type QuestionMatch = { item: AskedItem; updatedChoice: ChoiceItem | null };

function matchQuestionContent(
  item: AskedItem,
  normalized: ReturnType<typeof normalizeItem>,
): QuestionMatch | null {
  if (item.format !== normalized.format) {
    return null;
  }

  if (normalized.format === "multipleChoice") {
    const updatedChoice = matchChoice(item.content, normalized.content);
    return updatedChoice ? { item, updatedChoice } : null;
  }

  // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON drops undefined fields, as the column does.
  const content: unknown = JSON.parse(JSON.stringify(normalized.content));
  return isDeepStrictEqual(item.content, content) ? { item, updatedChoice: null } : null;
}

export function findQuestionMatch({
  items,
  question,
  skillId,
}: {
  items: Iterable<AskedItem>;
  question: ScreenQuestion;
  skillId: string;
}): QuestionMatch | null {
  const normalized = normalizeItem(question);

  for (const item of items) {
    const match = item.skillId === skillId ? matchQuestionContent(item, normalized) : null;

    if (match) {
      return match;
    }
  }

  return null;
}

export async function reuseQuestionItem(
  tx: TransactionClient,
  { item, updatedChoice }: QuestionMatch,
): Promise<string> {
  if (updatedChoice && !isDeepStrictEqual(item.content, updatedChoice)) {
    await tx.item.update({ data: { content: updatedChoice }, where: { id: item.id } });
    await tx.answerExplanation.deleteMany({ where: { itemId: item.id } });
  }

  return item.id;
}

export function questionItemData({
  language,
  question,
  skillId,
}: {
  language: string;
  question: ScreenQuestion;
  skillId: string;
}) {
  return { ...toStoredItem(question), language, skillId };
}

export async function saveQuestionItem(
  tx: TransactionClient,
  {
    available,
    language,
    screen,
  }: { available: Map<string, AskedItem>; language: string; screen: QuestionScreen },
): Promise<string | null> {
  const { provenance, question, skillId } = screen;

  if (!question || !skillId) {
    return null;
  }

  const match = findQuestionMatch({ items: available.values(), question, skillId });

  if (match) {
    available.delete(match.item.id);
    return reuseQuestionItem(tx, match);
  }

  const item = await tx.item.create({
    data: { ...questionItemData({ language, question, skillId }), ...toProvenanceData(provenance) },
  });

  return item.id;
}

/** Run before retiring the current version so its questions can keep their IDs. */
export async function saveQuestionItems(
  tx: TransactionClient,
  {
    language,
    lessonId,
    screens,
  }: { language: string; lessonId: string; screens: readonly QuestionScreen[] },
): Promise<(string | null)[]> {
  const skillIds = screens.flatMap(({ question, skillId }) =>
    question && skillId ? [skillId] : [],
  );

  if (skillIds.length === 0) {
    return screens.map(() => null);
  }

  const [asked, matchingSkills] = await Promise.all([
    tx.item.findMany({
      select: { content: true, format: true, id: true, skillId: true },
      where: { steps: { some: { lessonId, ...CURRENT_STEPS } } },
    }),
    findMatchingSkills(tx, { lessonId, skillIds }),
  ]);

  const available = new Map(asked.map((item) => [item.id, item]));
  const allowed = new Set(matchingSkills.map(({ id }) => id));

  return Promise.all(
    screens.map((screen) =>
      screen.skillId && allowed.has(screen.skillId)
        ? saveQuestionItem(tx, { available, language, screen })
        : Promise.resolve(null),
    ),
  );
}

async function findMatchingSkills(
  tx: TransactionClient,
  { lessonId, skillIds }: { lessonId: string; skillIds: string[] },
) {
  const { identityKey, ownerId } = await tx.lesson.findUniqueOrThrow({
    select: { identityKey: true, ownerId: true },
    where: { id: lessonId },
  });

  if (isSecondTakeIdentityKey(identityKey)) {
    return [];
  }

  return tx.skill.findMany({ select: { id: true }, where: { id: { in: skillIds }, ownerId } });
}

import "server-only";
import { isDeepStrictEqual } from "node:util";
import { GENERATED_ITEM_SCHEMAS, type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { type Item, type TransactionClient } from "@zoonk/db";
import { z } from "zod";
import { type LibraryProvenance, toProvenanceData } from "../../_utils/library-rows";
import { parseItemContent, toStoredItem } from "../../items/item-content";
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

export function matchCheckQuestion(
  previous: unknown,
  next: Extract<ScreenQuestion, { format: "multipleChoice" }>,
) {
  return matchChoice(previous, toStoredItem(next).content);
}

export async function updateCheckQuestion(
  tx: TransactionClient,
  item: AskedItem,
  content: ChoiceItem,
): Promise<void> {
  if (!isDeepStrictEqual(item.content, content)) {
    await tx.item.update({ data: { content }, where: { id: item.id } });
    await tx.answerExplanation.deleteMany({ where: { itemId: item.id } });
  }
}

function matchingContent(
  item: AskedItem,
  stored: ReturnType<typeof toStoredItem>,
): ChoiceItem | true | null {
  if (item.format !== stored.format) {
    return null;
  }

  if (stored.format === "multipleChoice") {
    return matchChoice(item.content, stored.content);
  }

  // oxlint-disable-next-line unicorn/prefer-structured-clone -- JSON drops undefined fields, as the column does.
  const content: unknown = JSON.parse(JSON.stringify(stored.content));
  return isDeepStrictEqual(item.content, content) ? true : null;
}

function findMatch(
  asked: readonly AskedItem[],
  skillId: string,
  stored: ReturnType<typeof toStoredItem>,
) {
  for (const item of asked) {
    const content = item.skillId === skillId ? matchingContent(item, stored) : null;

    if (content) {
      return { content, item };
    }
  }

  return null;
}

async function reuseQuestionItem(
  tx: TransactionClient,
  match: NonNullable<ReturnType<typeof findMatch>>,
) {
  if (match.content !== true) {
    await updateCheckQuestion(tx, match.item, match.content);
  }

  return match.item.id;
}

export async function saveQuestionItem(
  tx: TransactionClient,
  {
    language,
    previous,
    screen,
  }: { language: string; previous: AskedItem | null; screen: QuestionScreen },
): Promise<string | null> {
  if (!screen.question || !screen.skillId) {
    return null;
  }

  const stored = toStoredItem(screen.question);
  const match = findMatch(previous ? [previous] : [], screen.skillId, stored);

  return match
    ? reuseQuestionItem(tx, match)
    : createQuestionItem(tx, {
        language,
        provenance: screen.provenance,
        skillId: screen.skillId,
        stored,
      });
}

async function createQuestionItem(
  tx: TransactionClient,
  {
    language,
    provenance,
    skillId,
    stored,
  }: {
    language: string;
    provenance: LibraryProvenance;
    skillId: string;
    stored: ReturnType<typeof toStoredItem>;
  },
): Promise<string> {
  const item = await tx.item.create({
    data: { ...stored, language, skillId, ...toProvenanceData(provenance) },
  });

  return item.id;
}

export async function saveQuestionItems(
  tx: TransactionClient,
  {
    language,
    lessonId,
    screens,
  }: { language: string; lessonId: string; screens: readonly QuestionScreen[] },
): Promise<(string | null)[]> {
  if (!screens.some(({ question, skillId }) => question && skillId)) {
    return screens.map(() => null);
  }

  const choiceSkillIds = screens.flatMap(({ question, skillId }) =>
    question?.format === "multipleChoice" && skillId ? [skillId] : [],
  );

  const [asked, matchingSkills] = await Promise.all([
    tx.item.findMany({
      select: { content: true, format: true, id: true, skillId: true },
      where: { steps: { some: { lessonId, ...CURRENT_STEPS } } },
    }),
    choiceSkillIds.length > 0 ? findMatchingSkills(tx, { lessonId, skillIds: choiceSkillIds }) : [],
  ]);

  const available = new Map(asked.map((item) => [item.id, item]));
  const allowed = new Set(matchingSkills.map(({ id }) => id));

  return Promise.all(
    screens.map(async ({ provenance, question, skillId }) => {
      if (
        !question ||
        !skillId ||
        (question.format === "multipleChoice" && !allowed.has(skillId))
      ) {
        return null;
      }

      const stored = toStoredItem(question);
      const match = findMatch([...available.values()], skillId, stored);

      if (match) {
        available.delete(match.item.id);
        return reuseQuestionItem(tx, match);
      }

      return createQuestionItem(tx, { language, provenance, skillId, stored });
    }),
  );
}

async function findMatchingSkills(
  tx: TransactionClient,
  { lessonId, skillIds }: { lessonId: string; skillIds: string[] },
) {
  const { ownerId } = await tx.lesson.findUniqueOrThrow({
    select: { ownerId: true },
    where: { id: lessonId },
  });

  return tx.skill.findMany({ select: { id: true }, where: { id: { in: skillIds }, ownerId } });
}

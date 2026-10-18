import "server-only";
import { prisma } from "@zoonk/db";
import { getString, isJsonObject } from "@zoonk/utils/json";

/** Enough real questions to show a writer the exam's difficulty, few enough to keep prompts short. */
const MAX_EXAMPLES = 2;

/** A long support text says little more about difficulty than its start. */
const MAX_EXAMPLE_LENGTH = 1200;

/** Option letters as papers print them: a question has at most eight options. */
const OPTION_LETTERS = "ABCDEFGH";

/** A stored question as a writer reads it: its support text, its command and its options. */
function toExampleText(content: unknown): string | null {
  if (!isJsonObject(content)) {
    return null;
  }

  const options = Array.isArray(content.options)
    ? content.options.flatMap((option) =>
        isJsonObject(option) && typeof option.text === "string" ? [option.text] : [],
      )
    : [];

  const text = [
    getString(content, "context"),
    getString(content, "question") ?? getString(content, "statement"),
    ...options.map((option, index) => `(${OPTION_LETTERS[index] ?? index + 1}) ${option}`),
  ]
    .filter(Boolean)
    .join("\n");

  return text ? text.slice(0, MAX_EXAMPLE_LENGTH) : null;
}

/**
 * A few real questions from the exam's past papers (the ones its board lets us quote, already in
 * the bank), for a writer to match in difficulty, length and steps: the skills' own first, else
 * any of the exam's. Empty for an exam without quoted papers.
 */
export async function listPastQuestionExamples({
  examBlueprintId,
  skillIds,
}: {
  examBlueprintId: string;
  skillIds: readonly string[];
}): Promise<string[]> {
  const quoted = { content: { equals: true, path: ["quoted"] }, examBlueprintId };
  const read = { orderBy: { id: "asc" }, select: { content: true }, take: MAX_EXAMPLES } as const;

  const [own, other] = await Promise.all([
    prisma.item.findMany({ ...read, where: { ...quoted, skillId: { in: [...skillIds] } } }),
    prisma.item.findMany({ ...read, where: quoted }),
  ]);

  const texts = [...own, ...other].flatMap((row) => toExampleText(row.content) ?? []);
  return [...new Set(texts)].slice(0, MAX_EXAMPLES);
}

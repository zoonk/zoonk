import { type Item } from "@zoonk/db";
import { logError } from "@zoonk/utils/logger";
import { formatMathAnswer, getUnitPosition } from "@zoonk/utils/math-answer";
import { hashSeed, seededRandom } from "@zoonk/utils/seeded-random";
import { z } from "zod";
import { type MathValues } from "../../library/items/_utils/math-values";
import { type ParsedItemContent, parseItemContent } from "../../library/items/item-content";
import { type MathVersion, checkMathAnswer, withNewNumbers } from "../../library/items/item-math";
import { type MistakeSnapshot } from "../../mistakes/mistake-snapshot";

type MathContent = Extract<ParsedItemContent, { format: "numeric" }>["content"];

/** A math item: a problem stored as data, asked with fresh numbers each time it's served. */
export type MathItem = Pick<Item, "id" | "language" | "skillId"> & {
  content: MathContent;
  format: "numeric";
};

type BankItem = Pick<Item, "content" | "format" | "id" | "language" | "skillId">;

/**
 * Reads a bank item as a math problem, or null when it isn't one. Stored content passed the item
 * checks, so a parse failure is logged and the item skipped instead of failing the learner.
 */
export function parseMathItem(item: BankItem): MathItem | null {
  if (item.format !== "numeric") {
    return null;
  }

  try {
    const parsed = parseItemContent({ content: item.content, format: item.format });

    return parsed.format === "numeric"
      ? { ...parsed, id: item.id, language: item.language, skillId: item.skillId }
      : null;
  } catch (error) {
    logError(`Item ${item.id} has content that doesn't match its format.`, error);
    return null;
  }
}

/**
 * The numbers one serving shows, drawn from its `seed` (such as the session block that asks it), so
 * showing and grading the serving always agree and the next serving gets new ones.
 */
export function serveMath({ item, seed }: { item: MathItem; seed: string }): MathVersion {
  return withNewNumbers({
    ...item.content,
    language: item.language,
    random: seededRandom(hashSeed(seed)),
  });
}

/** The unit next to the answer field, where the item's language writes it ("R$ 45", "45 €"). */
function toUnitView({ language, unit }: { language: string; unit: string | null }) {
  return unit ? { position: getUnitPosition({ language, unit }), symbol: unit } : null;
}

/** The question with this serving's numbers, never its answer. */
export function toMathQuestionView({ item, version }: { item: MathItem; version: MathVersion }) {
  return {
    context: version.context,
    format: item.format,
    itemId: item.id,
    options: null,
    question: version.question,
    skillId: item.skillId,
    unit: toUnitView({ language: item.language, unit: item.content.math.unit }),
  };
}

function formatAnswer({ item, value }: { item: MathItem; value: number }): string {
  return formatMathAnswer({ language: item.language, unit: item.content.math.unit, value });
}

/**
 * Grades a typed number against the numbers the learner saw. A wrong answer that matches a common
 * mistake explains that mistake; the worked steps show the way with the same numbers. The attempt
 * keeps the numbers, so earlier answers can be read exactly later.
 */
export function gradeMathAnswer({
  answer,
  item,
  version,
}: {
  answer: number | null;
  item: MathItem;
  version: MathVersion;
}) {
  const graded =
    answer === null
      ? { isCorrect: false, mistake: null }
      : checkMathAnswer({ answer, math: item.content.math, values: version.values });

  const explanation = graded.mistake?.reason ?? null;

  const snapshot: MistakeSnapshot = {
    answer: answer === null ? null : formatAnswer({ item, value: answer }),
    correctAnswer: formatAnswer({ item, value: version.answer }),
    explanation: [explanation, ...version.steps].filter(Boolean).join(" "),
    format: item.format,
    misconception: graded.mistake?.misconception ?? null,
    question: [version.context, version.question].filter(Boolean).join(" "),
  };

  return {
    correctAnswer: { number: version.answer },
    explanation,
    isCorrect: graded.isCorrect,
    recorded: { number: answer, values: version.values },
    snapshot,
    workedSteps: version.steps,
  };
}

const recordedMathSchema = z.object({
  number: z.number().nullable(),
  values: z.record(z.string(), z.number()),
});

/** A math answer as its attempt stored it: the number typed and the numbers it was asked with. */
export function readRecordedMath(answer: unknown): z.infer<typeof recordedMathSchema> | null {
  const parsed = recordedMathSchema.safeParse(answer);
  return parsed.success ? parsed.data : null;
}

function isSameVersion(a: Readonly<MathValues>, b: Readonly<MathValues>): boolean {
  const names = Object.keys(a);
  return names.length === Object.keys(b).length && names.every((name) => a[name] === b[name]);
}

/**
 * An earlier answer as text, for "On Sep 30 you answered R$ 45". Only when that serving had the
 * same numbers as this one: with other numbers, the old answer says nothing about today's.
 */
export function describeEarlierMathAnswer({
  answer,
  item,
  version,
}: {
  answer: unknown;
  item: MathItem;
  version: MathVersion;
}): string | null {
  const recorded = readRecordedMath(answer);

  if (!recorded || recorded.number === null || !isSameVersion(recorded.values, version.values)) {
    return null;
  }

  return formatAnswer({ item, value: recorded.number });
}

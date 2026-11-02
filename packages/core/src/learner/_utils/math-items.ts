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

export type MathItem = Pick<Item, "id" | "language" | "skillId"> & {
  content: MathContent;
  format: "numeric";
};

type BankItem = Pick<Item, "content" | "format" | "id" | "language" | "skillId">;

/** Returns null for nonnumeric or invalid content; parse failures are logged. */
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

/** Reuse the same seed when showing and grading a serving. */
export function serveMath({ item, seed }: { item: MathItem; seed: string }): MathVersion {
  return withNewNumbers({
    ...item.content,
    language: item.language,
    random: seededRandom(hashSeed(seed)),
  });
}

function toUnitView({ language, unit }: { language: string; unit: string | null }) {
  return unit ? { position: getUnitPosition({ language, unit }), symbol: unit } : null;
}

/** Omits the answer. */
export function toMathQuestionView({ item, version }: { item: MathItem; version: MathVersion }) {
  return {
    context: version.context,
    entry: item.content.entry,
    format: item.format,
    image: null,
    itemId: item.id,
    options: null,
    question: version.question,
    skillId: item.skillId,
    unit: toUnitView({ language: item.language, unit: item.content.math.unit }),
    visual: null,
  };
}

function formatAnswer({ item, value }: { item: MathItem; value: number }): string {
  return formatMathAnswer({ language: item.language, unit: item.content.math.unit, value });
}

/** version must be the serving the learner saw; the attempt preserves its numbers. */
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
      : checkMathAnswer({
          answer,
          entry: item.content.entry,
          math: item.content.math,
          otherSolutions: item.content.otherSolutions,
          values: version.values,
        });

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

/** Returns null for invalid stored answers. */
export function readRecordedMath(answer: unknown): z.infer<typeof recordedMathSchema> | null {
  const parsed = recordedMathSchema.safeParse(answer);
  return parsed.success ? parsed.data : null;
}

function isSameVersion(a: Readonly<MathValues>, b: Readonly<MathValues>): boolean {
  const names = Object.keys(a);
  return names.length === Object.keys(b).length && names.every((name) => a[name] === b[name]);
}

/** Returns nothing unless the recorded answer used the same numbers as the current serving. */
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

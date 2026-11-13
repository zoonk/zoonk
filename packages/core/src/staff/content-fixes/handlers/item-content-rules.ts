import { isDeepStrictEqual } from "node:util";
import { type GeneratedItem } from "@zoonk/ai/tasks/items/schemas";
import { type ItemFormat } from "@zoonk/db";
import { z } from "zod";
import { checkItem } from "../../../library/items/item-checks";
import {
  type ParsedItemContent,
  parseItemContent,
  toStoredItem,
} from "../../../library/items/item-content";
import { type Json, type Refusal, refuse, toJson } from "../_utils/resolved-change";

/** Choice questions are graded by option index and flag, so their wording can change in place. */
const IN_PLACE_FORMATS = new Set<ItemFormat>(["multipleChoice", "trueFalse"]);

const REPLACE_INSTEAD =
  "Use { model: 'Item', id, replace: { content } } instead: it retires this question, so open sessions keep grading it, and new practice asks the corrected copy.";

function parseContent({
  content,
  format,
}: {
  content: Json;
  format: ItemFormat;
}): ParsedItemContent | Refusal {
  try {
    return parseItemContent({ content, format });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
      return refuse(`content doesn't fit a ${format} question: ${issues.join("; ")}`);
    }

    throw error;
  }
}

function shownWith({ content }: ParsedItemContent) {
  return {
    image: "image" in content ? content.image : null,
    quoted: "quoted" in content ? content.quoted : undefined,
    visual: "visual" in content ? content.visual : null,
  };
}

/** What grades a choice question, which picks by option index and flag, and what it shows. */
function gradingInputs(parsed: ParsedItemContent) {
  const { content, format } = parsed;
  const shown = shownWith(parsed);

  if (format === "multipleChoice") {
    return {
      ...shown,
      fixedOrder: content.fixedOrder,
      keys: content.options.map((option) => option.isCorrect),
      select: content.select,
    };
  }

  return format === "trueFalse" ? { ...shown, isTrue: content.isTrue } : shown;
}

function problemsOf({ content, format }: ParsedItemContent, language: string): string[] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The content was parsed by `format`'s schema, so with its format it is that format's item.
  const item = { ...content, difficulty: "medium", format } as GeneratedItem;

  return checkItem({
    entry: "entry" in content ? content.entry : undefined,
    item,
    language,
    select: "select" in content ? content.select : undefined,
  });
}

type CheckedContent = { after: Json } | Refusal;

/**
 * Parses and checks a question's new content against its current row. In place, only words may
 * change; a replacement may change anything but its format and picture, which another fix can't
 * draw or check yet.
 */
export function checkItemContent({
  inPlace,
  item,
  sent,
}: {
  inPlace: boolean;
  item: { content: unknown; format: ItemFormat; id: string; language: string };
  sent: Json;
}): CheckedContent {
  if (inPlace && !IN_PLACE_FORMATS.has(item.format)) {
    return refuse(`A ${item.format} question is graded by its words. ${REPLACE_INSTEAD}`);
  }

  const before = parseContent({ content: toJson(item.content), format: item.format });
  const after = parseContent({ content: sent, format: item.format });

  if ("ok" in before) {
    return refuse(`Item ${item.id}'s stored content doesn't parse, so it can't be fixed in place.`);
  }

  if ("ok" in after) {
    return after;
  }

  if (inPlace && !isDeepStrictEqual(gradingInputs(before), gradingInputs(after))) {
    return refuse(
      `This changes how answers are graded or what's shown with the question (which answers are right, how many to pick, the options' count or order, the picture or the visual). ${REPLACE_INSTEAD}`,
    );
  }

  if (!isDeepStrictEqual(shownWith(before).image, shownWith(after).image)) {
    return refuse("The question keeps its picture request; a fix can't draw a new picture yet.");
  }

  const problems = problemsOf(after, item.language);

  if (problems.length > 0) {
    return refuse(`content: ${problems.join(" ")}`);
  }

  return isDeepStrictEqual(after.content, before.content)
    ? refuse(`Item ${item.id} already has this content.`)
    : { after: toJson(after.content) };
}

/**
 * A lesson screen's numeric question is stored as the lesson stores it (`toStoredItem`), so the
 * screen and its practice question stay one question that a later version of the lesson reuses.
 */
export function checkScreenItemContent({
  item,
  sent,
}: {
  item: { content: unknown; format: ItemFormat; id: string; language: string };
  sent: Json;
}): CheckedContent {
  const before = parseContent({ content: toJson(item.content), format: item.format });
  const after = parseContent({ content: sent, format: item.format });

  if ("ok" in before) {
    return refuse(`Item ${item.id}'s stored content doesn't parse, so it can't be fixed.`);
  }

  if ("ok" in after) {
    return after;
  }

  if (after.format !== "numeric") {
    return refuse(`Item ${item.id} isn't a numeric question.`);
  }

  const problems = problemsOf(after, item.language);

  if (problems.length > 0) {
    return refuse(`content: ${problems.join(" ")}`);
  }

  const { entry, ...question } = after.content;

  const stored = toJson(
    // oxlint-disable-next-line unicorn/prefer-structured-clone -- Compares as the column stores it: JSON drops undefined fields, which a clone keeps.
    JSON.parse(
      JSON.stringify(
        toStoredItem({ ...question, difficulty: "medium", format: "numeric" }, { entry }).content,
      ),
    ),
  );

  return isDeepStrictEqual(stored, toJson(item.content))
    ? refuse(`Item ${item.id} already has this content.`)
    : { after: stored };
}

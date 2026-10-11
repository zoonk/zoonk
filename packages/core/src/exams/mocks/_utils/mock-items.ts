import "server-only";
import { prisma } from "@zoonk/db";
import {
  type ChoiceItem,
  parseChoiceItem,
  toQuestionView,
} from "../../../learner/_utils/choice-items";
import {
  type MathItem,
  parseMathItem,
  serveMath,
  toMathQuestionView,
} from "../../../learner/_utils/math-items";
import {
  type TypedItem,
  parseTypedItem,
  toTypedQuestionView,
} from "../../../learner/_utils/typed-items";
import { ITEM_IMAGE_INCLUDE } from "../../../library/items/item-image";
import { type ItemSetView } from "../../../library/items/item-set-view";
import { ITEM_SET_INCLUDE, toItemSetView } from "../../../library/items/item-sets";
import {
  type ItemCitation,
  citedSourceSelect,
  toItemCitation,
} from "../../../library/sources/source-citation";
import { type IrtItem, toIrtItem } from "../../scoring/irt";
import { type MockQuestion } from "../mock-view-contract";

/** A question a mock asks in the exam's own format: a pick, a typed number or a typed word. */
type MockQuestionItem = ChoiceItem | MathItem | TypedItem;

/**
 * A mock question with what grading and the review need: how hard it is for item response theory,
 * the passage it quotes (an article of law, a past exam) with a link to the official text, and the
 * text it shares with its set's other questions, when it's one of a set.
 */
export type MockItem = MockQuestionItem & {
  citation: ItemCitation | null;
  irt: IrtItem;
  set: ItemSetView | null;
};

const TRUE_FALSE_OPTIONS = 2;

/** The options a learner could guess from: none for a typed answer. */
function getOptionCount(item: MockQuestionItem): number {
  if (item.format === "trueFalse") {
    return TRUE_FALSE_OPTIONS;
  }

  return item.format === "multipleChoice" ? item.content.options.length : 0;
}

function parseMockQuestionItem(
  row: Parameters<typeof parseChoiceItem>[0],
): MockQuestionItem | null {
  switch (row.format) {
    case "numeric":
      return parseMathItem(row);
    case "typed":
      return parseTypedItem(row);
    case "multipleChoice":
    case "trueFalse":
      return parseChoiceItem(row);
    case "essay":
    case "matchPairs":
    case "order":
    case "spoken":
      return null;
    default:
      throw new Error("Unknown item format.");
  }
}

/** The mock's questions by id. Items that no longer parse are left out and read as blank. */
export async function loadMockItems(
  itemIds: readonly string[],
  /** A finished mock's review shows what a recording said (its transcript). */
  { reveal = false }: { reveal?: boolean } = {},
): Promise<Map<string, MockItem>> {
  const rows = await prisma.item.findMany({
    include: { ...ITEM_IMAGE_INCLUDE, ...ITEM_SET_INCLUDE, source: { select: citedSourceSelect } },
    where: { id: { in: [...itemIds] } },
  });

  return new Map(
    rows.flatMap((row) => {
      const item = parseMockQuestionItem(row);

      if (!item) {
        return [];
      }

      const mockItem: MockItem = {
        ...item,
        citation: toItemCitation(row),
        irt: toIrtItem({
          difficulty: row.difficulty,
          discrimination: row.discrimination,
          options: getOptionCount(item),
        }),
        set: toItemSetView({ item: row, reveal }),
      };

      return [[row.id, mockItem] as const];
    }),
  );
}

/**
 * A numeric question's numbers in one mock: drawn from the mock and the question, so showing and
 * grading it agree on every visit, and the next mock asks it with new ones.
 */
export function serveMockMath({ item, mockId }: { item: MathItem; mockId: string }) {
  return serveMath({ item, seed: `${mockId}:${item.id}` });
}

/** What a question shows only in other formats. */
const NO_EXTRAS = { entry: null, select: null, unit: null };

function toFormatView({ item, mockId }: { item: MockItem; mockId: string }) {
  switch (item.format) {
    case "numeric": {
      const version = serveMockMath({ item, mockId });
      return { ...NO_EXTRAS, ...toMathQuestionView({ item, version }) };
    }
    case "typed":
      return { ...NO_EXTRAS, ...toTypedQuestionView(item) };
    case "multipleChoice":
    case "trueFalse":
      return { ...NO_EXTRAS, ...toQuestionView(item) };
    default:
      throw new Error("Unknown mock question format.");
  }
}

/**
 * A question as the running mock shows it, with the text its set's questions share: never its
 * answer or why.
 */
export function toMockQuestionView({
  item,
  mockId,
}: {
  item: MockItem;
  mockId: string;
}): Omit<MockQuestion, "area" | "number"> {
  return { ...toFormatView({ item, mockId }), set: item.set };
}

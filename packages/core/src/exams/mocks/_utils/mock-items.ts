import "server-only";
import { prisma } from "@zoonk/db";
import { type ChoiceItem, parseChoiceItem } from "../../../learner/_utils/choice-items";
import {
  type ItemCitation,
  citedSourceSelect,
  toItemCitation,
} from "../../../library/sources/source-citation";
import { type IrtItem, toIrtItem } from "../../scoring/irt";

/**
 * A mock question with what grading and the review need: how hard it is for item response theory,
 * and the passage it quotes (an article of law, a past exam) with a link to the official text.
 */
export type MockItem = ChoiceItem & { citation: ItemCitation | null; irt: IrtItem };

const TRUE_FALSE_OPTIONS = 2;

function getOptionCount(item: ChoiceItem): number {
  return item.format === "trueFalse" ? TRUE_FALSE_OPTIONS : item.content.options.length;
}

/** The mock's questions by id. Items that no longer parse are left out and read as blank. */
export async function loadMockItems(itemIds: readonly string[]): Promise<Map<string, MockItem>> {
  const rows = await prisma.item.findMany({
    include: { source: { select: citedSourceSelect } },
    where: { id: { in: [...itemIds] } },
  });

  return new Map(
    rows.flatMap((row) => {
      const item = parseChoiceItem(row);

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
      };

      return [[row.id, mockItem] as const];
    }),
  );
}

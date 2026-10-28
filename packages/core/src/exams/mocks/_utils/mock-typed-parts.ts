import "server-only";
import { type ItemFormat, prisma } from "@zoonk/db";
import { type MockTypedPart } from "../mock-left-out";
import { getFormatFilter } from "./mock-candidates";

const TYPED_PARTS: Partial<Record<ItemFormat, MockTypedPart>> = {
  numeric: "numeric",
  typed: "shortAnswer",
};

async function listTypedParts(
  where: { examBlueprintId: string } | { id: { in: string[] } },
): Promise<MockTypedPart[]> {
  const rows = await prisma.item.findMany({
    distinct: ["format"],
    select: { format: true },
    where: { AND: [where, getFormatFilter(["numeric", "typed"])] },
  });

  return rows.flatMap((row) => TYPED_PARTS[row.format] ?? []);
}

/**
 * The exam's typed formats its bank holds questions in, which its mocks ask as the exam does (a
 * number typed into a box, a word typed in): a mock says it asks the others as multiple choice.
 */
export function loadBankTypedParts(examBlueprintId: string | null): Promise<MockTypedPart[]> {
  return examBlueprintId ? listTypedParts({ examBlueprintId }) : Promise.resolve([]);
}

/**
 * `loadBankTypedParts` for a page: the same for every learner of the exam, so it's cached once for
 * all of them; a question the API adds shows within the default revalidation. Starting a mock
 * reads it fresh.
 */
export async function getBankTypedParts(examBlueprintId: string | null): Promise<MockTypedPart[]> {
  "use cache";

  return loadBankTypedParts(examBlueprintId);
}

/** The typed formats a sat mock asked, among its questions (see `loadBankTypedParts`). */
export function loadAskedTypedParts(itemIds: readonly string[]): Promise<MockTypedPart[]> {
  return listTypedParts({ id: { in: [...itemIds] } });
}

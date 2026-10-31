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

export function loadBankTypedParts(examBlueprintId: string | null): Promise<MockTypedPart[]> {
  return examBlueprintId ? listTypedParts({ examBlueprintId }) : Promise.resolve([]);
}

/** Cached for GET readers; use `loadBankTypedParts` for a fresh write precondition. */
export async function getBankTypedParts(examBlueprintId: string | null): Promise<MockTypedPart[]> {
  "use cache";

  return loadBankTypedParts(examBlueprintId);
}

export function loadAskedTypedParts(itemIds: readonly string[]): Promise<MockTypedPart[]> {
  return listTypedParts({ id: { in: [...itemIds] } });
}

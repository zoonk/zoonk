import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../../library/_utils/library-visibility";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { PLACEMENT_ITEM_FORMATS, isPlacementItem } from "./placement-items";

export async function loadPlacementItems({
  examBlueprintId,
  skillIds,
  userId,
  tx = prisma,
}: {
  examBlueprintId: string | null;
  skillIds: string[];
  userId?: string;
  tx?: TransactionClient;
}) {
  const items = await tx.item.findMany({
    orderBy: { id: "asc" },
    select: { content: true, difficulty: true, format: true, id: true, skillId: true },
    where: {
      format: { in: [...PLACEMENT_ITEM_FORMATS] },
      skillId: { in: skillIds },
      ...(userId && { skill: libraryRowsVisibleTo(userId) }),
      ...getItemAudienceFilter({ examBlueprintId }),
    },
  });

  return items.filter((item) => isPlacementItem(item));
}

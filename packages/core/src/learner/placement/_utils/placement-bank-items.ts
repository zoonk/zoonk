import "server-only";
import { type TransactionClient, prisma } from "@zoonk/db";
import { getItemAudienceFilter } from "../../../library/items/item-field";
import { PLACEMENT_ITEM_FORMATS, isPlacementItem } from "./placement-items";

export async function loadPlacementItems({
  examBlueprintId,
  skillIds,
  tx = prisma,
}: {
  examBlueprintId: string | null;
  skillIds: string[];
  tx?: TransactionClient;
}) {
  const items = await tx.item.findMany({
    orderBy: { id: "asc" },
    select: { content: true, difficulty: true, format: true, id: true, skillId: true },
    where: {
      format: { in: [...PLACEMENT_ITEM_FORMATS] },
      skillId: { in: skillIds },
      ...getItemAudienceFilter({ examBlueprintId }),
    },
  });

  return items.filter((item) => isPlacementItem(item));
}

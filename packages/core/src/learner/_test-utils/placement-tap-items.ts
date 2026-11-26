import { type Item } from "@zoonk/db";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { gradeOrder, parseOrderItem } from "../../sessions/_utils/order-items";
import { getPlacementBlockId } from "../placement/_utils/placement-items";

type TapItem = { answer: { order: number[] }; item: Item };

export async function lowGuessTapItems(skillId: string): Promise<TapItem[]> {
  return Promise.all(
    ["D", "E", "F"].map(async (end) => {
      const item = await itemFixture({
        content: { question: "Order the steps", reason: "Sequence", steps: ["A", "B", "C", end] },
        format: "order",
        skillId,
      });

      const parsed = parseOrderItem(item);

      if (!parsed) {
        throw new Error("Expected an order item");
      }

      return {
        answer: gradeOrder({
          answer: { dontKnow: true },
          blockId: getPlacementBlockId(parsed),
          item: parsed,
        }).correctAnswer,
        item,
      };
    }),
  );
}

export async function placementItemBank(skillIds: readonly string[]) {
  return Promise.all(
    skillIds.map(async (skillId) => {
      const [item, taps] = await Promise.all([
        itemFixture({ content: choiceItemContent(), skillId }),
        lowGuessTapItems(skillId),
      ]);

      return [{ answer: { selectedIndex: 0 }, item }, ...taps];
    }),
  );
}

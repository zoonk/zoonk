import { type Item } from "@zoonk/db";
import { choiceItemContent, itemFixture } from "@zoonk/testing/fixtures/skills";
import { gradeOrder, parseOrderItem } from "../../sessions/_utils/order-items";
import {
  getPlacementBlockId,
  gradePlacementAnswer,
  parsePlacementItem,
} from "../placement/_utils/placement-items";

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

type BankEntry = { answer: { selectedIndex: number } | TapItem["answer"]; item: Item };

export async function placementItemBank(skillIds: readonly string[]): Promise<BankEntry[][]> {
  return Promise.all(
    skillIds.map(async (skillId) => {
      const [item, taps] = await Promise.all([
        itemFixture({ content: choiceItemContent(), skillId }),
        lowGuessTapItems(skillId),
      ]);

      const parsed = parsePlacementItem(item);

      if (!parsed) {
        throw new Error("Expected a placement question");
      }

      const { correctAnswer } = gradePlacementAnswer({ answer: { dontKnow: true }, item: parsed });

      if (!correctAnswer || !("selectedIndex" in correctAnswer)) {
        throw new Error("Expected a one-pick question");
      }

      return [{ answer: { selectedIndex: correctAnswer.selectedIndex }, item }, ...taps];
    }),
  );
}

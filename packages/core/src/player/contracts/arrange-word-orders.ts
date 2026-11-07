import {
  type ArrangeText,
  normalizeArrangeWord,
  segmentArrangeWords,
} from "./arrange-words-answers";

const SEPARATOR = "\u0000";

function toOrderKey(words: readonly string[]): string {
  return words.map((word) => normalizeArrangeWord(word)).join(SEPARATOR);
}

function toTilesKey(words: readonly string[]): string {
  return words
    .map((word) => normalizeArrangeWord(word))
    .toSorted()
    .join(SEPARATOR);
}

/**
 * Keeps the other orders a learner can build from the text's own tiles, as its screen splits and
 * compares them: the same tiles in a different order, each order once.
 */
export function keepOtherArrangeOrders({
  kind,
  orders,
  text,
}: ArrangeText & { orders: readonly string[] }): string[] {
  const words = segmentArrangeWords({ kind, text });
  const tiles = toTilesKey(words);
  const seen = new Set([toOrderKey(words)]);

  return orders.filter((order) => {
    const orderWords = segmentArrangeWords({ kind, text: order });
    const key = toOrderKey(orderWords);

    if (seen.has(key) || toTilesKey(orderWords) !== tiles) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

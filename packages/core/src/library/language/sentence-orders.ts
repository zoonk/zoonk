import { normalizePunctuation } from "@zoonk/utils/string";
import { keepOtherArrangeOrders } from "../../player/contracts/arrange-word-orders";

export type SentenceOrders = { otherOrders: string[]; otherTranslationOrders: string[] };

type WrittenSentence = SentenceOrders & { sentence: string; translation: string };

function cleanOrders(orders: readonly string[]): string[] {
  return orders.map((order) => normalizePunctuation(order).trim());
}

/**
 * Keeps the orders a learner can build from the sentence's tiles: reading builds the sentence,
 * listening its translation. A learner reading the app in the language they learn hears the sentence
 * and builds it again, so its orders are the sentence's.
 */
export function keepSentenceOrders({
  sameLanguage,
  sentence,
}: {
  sameLanguage: boolean;
  sentence: WrittenSentence;
}): SentenceOrders {
  const translationOrders = sameLanguage ? sentence.otherOrders : sentence.otherTranslationOrders;

  return {
    otherOrders: keepOtherArrangeOrders({
      kind: "reading",
      orders: cleanOrders(sentence.otherOrders),
      text: sentence.sentence,
    }),
    otherTranslationOrders: keepOtherArrangeOrders({
      kind: "listening",
      orders: cleanOrders(translationOrders),
      text: sentence.translation,
    }),
  };
}

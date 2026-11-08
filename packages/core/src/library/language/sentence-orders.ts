import "server-only";
import { checkSentenceOrders } from "@zoonk/ai/tasks/language/check-sentence-orders";
import { type LanguageSentenceOrders } from "@zoonk/ai/tasks/language/language-sentence-orders";
import { isSameLanguage } from "@zoonk/utils/languages";
import { keepOtherArrangeOrders } from "../../player/contracts/arrange-word-orders";
import { type ArrangeText } from "../../player/contracts/arrange-words-answers";

export type SentenceOrders = { otherOrders: string[]; otherTranslationOrders: string[] };

type SentenceText = { sentence: string; translation: string };

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
  sentence: Partial<SentenceOrders> & SentenceText;
}): SentenceOrders {
  return {
    otherOrders: keepOtherArrangeOrders({
      kind: "reading",
      orders: sentence.otherOrders ?? [],
      text: sentence.sentence,
    }),
    otherTranslationOrders: keepOtherArrangeOrders({
      kind: "listening",
      orders: (sameLanguage ? sentence.otherOrders : sentence.otherTranslationOrders) ?? [],
      text: sentence.translation,
    }),
  };
}

/** Each buildable order as written, so the reviewer reads natural text instead of tiles. */
function pickCandidates({ kind, orders, text }: ArrangeText & { orders: readonly string[] }) {
  const seen = new Set<string>();

  return orders.filter((order) => {
    const [kept] = keepOtherArrangeOrders({ kind, orders: [order], text });

    if (!kept || seen.has(kept)) {
      return false;
    }

    seen.add(kept);
    return true;
  });
}

/**
 * The generated orders a learner could build, once each, for review. In the learner's own language
 * the translation's orders are the sentence's, so none are reviewed for it.
 */
export function toOrderCandidates({
  generated,
  sameLanguage,
  sentences,
}: {
  generated: LanguageSentenceOrders;
  sameLanguage: boolean;
  sentences: readonly SentenceText[];
}): SentenceOrders[] {
  if (generated.sentences.length !== sentences.length) {
    throw new Error("Sentence orders must include one result per requested sentence, in order.");
  }

  return sentences.map((item, index) => {
    const written = generated.sentences[index];

    return {
      otherOrders: pickCandidates({
        kind: "reading",
        orders: written?.otherOrders ?? [],
        text: item.sentence,
      }),
      otherTranslationOrders: sameLanguage
        ? []
        : pickCandidates({
            kind: "listening",
            orders: written?.otherTranslationOrders ?? [],
            text: item.translation,
          }),
    };
  });
}

function keepApproved({
  candidates,
  verdicts = [],
}: {
  candidates: readonly string[];
  verdicts?: readonly boolean[];
}): string[] {
  if (verdicts.length !== candidates.length) {
    throw new Error("The review must judge every candidate, in order.");
  }

  return candidates.filter((_candidate, index) => verdicts[index]);
}

/** The candidates a native teacher accepts, as the screen's tiles; a lesson without any skips the review. */
export async function checkOrderCandidates({
  analytics,
  candidates,
  learnerLanguage,
  sentences,
  serviceTier,
  targetLanguage,
}: Pick<
  Parameters<typeof checkSentenceOrders>[0],
  "analytics" | "learnerLanguage" | "serviceTier" | "targetLanguage"
> & { candidates: readonly SentenceOrders[]; sentences: readonly SentenceText[] }): Promise<
  SentenceOrders[]
> {
  const sameLanguage = isSameLanguage({ learnerLanguage, targetLanguage });

  const keep = (approved: readonly SentenceOrders[]) =>
    sentences.map((sentence, index) =>
      keepSentenceOrders({ sameLanguage, sentence: { ...sentence, ...approved[index] } }),
    );

  if (
    candidates.every((item) => [...item.otherOrders, ...item.otherTranslationOrders].length === 0)
  ) {
    return keep(candidates);
  }

  const { data } = await checkSentenceOrders({
    analytics,
    learnerLanguage,
    sentences: sentences.map(({ sentence, translation }, index) => ({
      sentence,
      sentenceCandidates: candidates[index]?.otherOrders ?? [],
      translation,
      translationCandidates: candidates[index]?.otherTranslationOrders ?? [],
    })),
    serviceTier,
    targetLanguage,
  });

  if (data.sentences.length !== sentences.length) {
    throw new Error("The review must include one result per requested sentence, in order.");
  }

  return keep(
    candidates.map((item, index) => ({
      otherOrders: keepApproved({
        candidates: item.otherOrders,
        verdicts: data.sentences[index]?.sentenceKeep,
      }),
      otherTranslationOrders: keepApproved({
        candidates: item.otherTranslationOrders,
        verdicts: data.sentences[index]?.translationKeep,
      }),
    })),
  );
}

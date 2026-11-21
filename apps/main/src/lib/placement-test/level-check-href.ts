import { type LevelCheckOffer } from "@zoonk/learn/session/level-check-offer";

/** Where a lesson's offer to check the learner's level opens: the test of what they know, or a language level's. */
export function getLevelCheckHref(offer: LevelCheckOffer) {
  return offer.kind === "quick" ? ("/placement-test" as const) : ("/level-test" as const);
}

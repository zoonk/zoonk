import { type LevelCheckOffer } from "@zoonk/learn/session/level-check-offer";

export const LEVEL_TEST_OUT_PARAM = "testOut";

/** Where a lesson's offer to check the learner's level opens: the test of what they know, or a level's test-out. */
export function getLevelCheckHref(offer: LevelCheckOffer) {
  return offer.kind === "quick"
    ? ("/placement-test" as const)
    : (`/level-test?${LEVEL_TEST_OUT_PARAM}=1` as const);
}

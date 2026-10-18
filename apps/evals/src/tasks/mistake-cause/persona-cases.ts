import { getSeedLearner, getSeedMistake } from "@/datasets/seed-learners";
import { type TestCase } from "@/lib/types";
import { type MistakeCauseParams } from "@zoonk/ai/tasks/v2/mistakes/cause";
import { type MistakeCauseExpected } from "./scorer";

/**
 * A mistake from a seed learner's notebook, with the inputs production builds from it (their
 * answers on the skill as recent accuracy). The label follows the classifier's rules, not the
 * cause the seed shows in the notebook.
 */
function personaCase({
  cause,
  learnerKey,
  mistakeKey,
}: MistakeCauseExpected & { learnerKey: string; mistakeKey: string }): TestCase<
  MistakeCauseExpected,
  MistakeCauseParams
> {
  const learner = getSeedLearner(learnerKey);
  const { key, ...mistake } = getSeedMistake({ key: mistakeKey, learner });

  return {
    expected: { cause },
    id: `${learner.language}-persona-${learnerKey}-${key}`,
    userInput: { ...mistake, language: learner.language },
  };
}

/** Mistakes from the seed learners' notebooks (shared eval dataset), in English and Portuguese. */
export const PERSONA_TEST_CASES: TestCase<MistakeCauseExpected, MistakeCauseParams>[] = [
  // A negative power read as a negative number: the rule itself is wrong.
  personaCase({ cause: "gap", learnerKey: "maya", mistakeKey: "negative-power" }),
  // The planet picture of the atom is a conceptual error, and nothing shows the idea is known.
  personaCase({ cause: "gap", learnerKey: "guest", mistakeKey: "cloud-spins-fast" }),
  // Only one of two resistors in series, and every answer on the skill was wrong.
  personaCase({ cause: "gap", learnerKey: "ana", mistakeKey: "circuit-one-resistor" }),
  // Bigger light as bigger photons: a wrong idea about what brightness is.
  personaCase({ cause: "gap", learnerKey: "lucas", mistakeKey: "brighter-photons" }),
  // Shareholders paid first: a wrong idea, no misconception pointing at a slip.
  personaCase({ cause: "gap", learnerKey: "pedro", mistakeKey: "bankruptcy-order" }),
  // "How many" for a price: the much/many rule isn't known yet.
  personaCase({ cause: "gap", learnerKey: "marcos", mistakeKey: "how-many-deposit" }),
  // Answered only the first month when the question named first and last month's rent.
  personaCase({ cause: "misread", learnerKey: "marcos", mistakeKey: "first-last-rent" }),
];

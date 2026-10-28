import { getSeedLearner, getSeedMistake } from "@/datasets/seed-learners";
import { type TestCase } from "@/lib/types";
import { type MistakeCauseParams } from "@zoonk/ai/tasks/v2/mistakes/cause";
import { type MistakeCauseExpected } from "./scorer";

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

export const PERSONA_TEST_CASES: TestCase<MistakeCauseExpected, MistakeCauseParams>[] = [
  personaCase({ cause: "gap", learnerKey: "maya", mistakeKey: "negative-power" }),
  personaCase({ cause: "gap", learnerKey: "guest", mistakeKey: "cloud-spins-fast" }),
  personaCase({ cause: "gap", learnerKey: "ana", mistakeKey: "circuit-one-resistor" }),
  personaCase({ cause: "gap", learnerKey: "lucas", mistakeKey: "brighter-photons" }),
  personaCase({ cause: "gap", learnerKey: "pedro", mistakeKey: "bankruptcy-order" }),
  personaCase({ cause: "gap", learnerKey: "marcos", mistakeKey: "how-many-deposit" }),
  personaCase({ cause: "misread", learnerKey: "marcos", mistakeKey: "first-last-rent" }),
];

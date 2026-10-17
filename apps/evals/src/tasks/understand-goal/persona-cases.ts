import { SEED_LEARNERS_TODAY, getSeedLearner } from "@/datasets/seed-learners";
import { type TestCase } from "@/lib/types";
import { type UnderstandGoalInput } from "@zoonk/ai/tasks/v2/goals/understand-goal";
import { type UnderstandGoalExpected } from "./scorer";

/** A seed learner's goal exactly as they typed it in onboarding, on the dataset's fixed day. */
function personaCase({
  expected,
  learnerKey,
}: {
  expected: UnderstandGoalExpected;
  learnerKey: string;
}): TestCase<UnderstandGoalExpected, UnderstandGoalInput> {
  const { goal, language } = getSeedLearner(learnerKey);

  return {
    expected,
    id: `${language}-persona-${learnerKey}`,
    userInput: { goal: goal.prompt, language, today: SEED_LEARNERS_TODAY },
  };
}

/** The goals the seed learners typed (shared eval dataset), in English and Portuguese. */
export const PERSONA_TEST_CASES: TestCase<UnderstandGoalExpected, UnderstandGoalInput>[] = [
  personaCase({
    expected: { goals: [{ kind: "learn", ownLevel: "none" }], route: "goals" },
    learnerKey: "maya",
  }),
  personaCase({ expected: { route: "explain" }, learnerKey: "sam" }),
  personaCase({
    expected: {
      goals: [{ examName: /enem/iu, hasTarget: true, hasTargetDate: false, kind: "exam" }],
      route: "goals",
    },
    learnerKey: "ana",
  }),
  personaCase({
    expected: {
      goals: [
        {
          kind: "language",
          month: "2027-03",
          nativeLanguage: "pt",
          ownLevel: "basic",
          targetLanguage: "en",
        },
      ],
      route: "goals",
    },
    learnerKey: "marcos",
  }),
  personaCase({
    expected: { goals: [{ hasTargetDate: false, kind: "learn" }], route: "goals" },
    learnerKey: "lucas",
  }),
];

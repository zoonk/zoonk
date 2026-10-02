import { getBaseURL } from "@zoonk/e2e/fixtures/base-url";
import { createE2EUser } from "@zoonk/e2e/fixtures/users";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { type Mode } from "./learn-personas";

/**
 * A signed-in Portuguese speaker learning English in `mode`, with no history: the course, goal
 * and plan of `languageGoalFixture`, whose renting unit's call is written at A2.
 */
export async function createLanguageLearner(mode: Mode) {
  const user = await createE2EUser(getBaseURL());
  const fixture = await languageGoalFixture({ userId: user.id });

  await learningProfileFixture({
    activeGoalId: fixture.goal.id,
    experienceMode: mode,
    userId: user.id,
  });

  return { ...fixture, user };
}

import "server-only";
import { prisma } from "@zoonk/db";
import { type SeededPast, type SeededToday, writeSeed, writeSeedPersonaCopy } from "@zoonk/db/seed";
import { buildSeededDay } from "./build-seeded-day";
import { buildSeededPast } from "./build-seeded-past";
import { buildSeededPastMissions } from "./build-seeded-past-missions";
import { planSeededGoal } from "./plan-seeded-goal";
import { type ScenarioState, writeScenarioState } from "./scenario-states";

/** Seed tooling only: the persona scripts read them. @internal */
export { SCENARIO_STATES, type ScenarioState } from "./scenario-states";

async function planSeededLearner({
  goalId,
  now,
  past,
  today,
}: {
  goalId: string;
  now: Date;
  past: SeededPast;
  today: SeededToday | null;
}): Promise<void> {
  await planSeededGoal({ goalId, now });
  await buildSeededPast({ goalId, past });
  await buildSeededPastMissions(goalId);

  if (today) {
    await buildSeededDay({ goalId, today });
  }
}

/** Seed tooling only; safe to run on an existing database. @internal */
export async function seed() {
  const { learners, now } = await writeSeed(prisma);

  // CPU-bound planning on one thread can starve concurrent Prisma transactions, so seed learners sequentially.
  await Object.values(learners).reduce<Promise<void>>(
    (previous, { goalId, past, today }) =>
      previous.then(() => planSeededLearner({ goalId, now, past, today })),
    Promise.resolve(),
  );

  return { learners };
}

/** Run seed first: copies reference its shared Library content. @internal */
export async function seedPersonaCopy({
  state,
  ...options
}: Parameters<typeof writeSeedPersonaCopy>[1] & { state?: ScenarioState }): Promise<{
  email: string;
  goalId: string;
  userId: string;
}> {
  const { now, past, today, ...copy } = await writeSeedPersonaCopy(prisma, options);
  await planSeededLearner({ goalId: copy.goalId, now, past, today });

  if (state) {
    await writeScenarioState({ goalId: copy.goalId, state, userId: copy.userId });
  }

  return copy;
}

import "server-only";
import { prisma } from "@zoonk/db";
import {
  type SeededPast,
  type SeededToday,
  writeSeedV2,
  writeSeedV2PersonaCopy,
} from "@zoonk/db/seed/v2";
import { buildSeededDay } from "./build-seeded-day";
import { buildSeededPast } from "./build-seeded-past";
import { buildSeededPastMissions } from "./build-seeded-past-missions";
import { planSeededGoal } from "./plan-seeded-goal";

/**
 * Plans a seeded learner's goal, fills its past bosses and mocks with the questions the app would
 * have asked, then builds the session the persona opened today from that plan with the app's
 * session builder, which reads those answers as the app would.
 */
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

/**
 * Seeds Zoonk v2 (see `writeSeedV2`): the Library courses and one learner per goal kind, each
 * with the plan the planner makes from what the persona did and today's session as the app builds
 * it from that plan, so the plan screen, Today and the persona's history agree. Runs again on top
 * of an existing database. Seed tooling for tests, E2E and the persona command, never the apps.
 *
 * @internal
 */
export async function seedV2() {
  const { learners, now } = await writeSeedV2(prisma);

  /**
   * One learner at a time: planning is CPU work on this one thread, so planning them together saves
   * nothing, and each learner's plan transaction waited on the others' planning to run its next
   * statement. On a busy CI runner that wait passed Prisma's limits, and the seed failed.
   */
  await Object.values(learners).reduce<Promise<void>>(
    (previous, { goalId, past, today }) =>
      previous.then(() => planSeededLearner({ goalId, now, past, today })),
    Promise.resolve(),
  );

  return { learners };
}

/**
 * Writes a private copy of one persona (see `writeSeedV2PersonaCopy`) with the plan the planner
 * makes for it on the day the copy is on, and that day's session as the app builds it. Run
 * `seedV2` first: the copy points at its Library content.
 *
 * @internal
 */
export async function seedV2PersonaCopy(
  options: Parameters<typeof writeSeedV2PersonaCopy>[1],
): Promise<{ email: string; goalId: string; userId: string }> {
  const { now, past, today, ...copy } = await writeSeedV2PersonaCopy(prisma, options);
  await planSeededLearner({ goalId: copy.goalId, now, past, today });
  return copy;
}

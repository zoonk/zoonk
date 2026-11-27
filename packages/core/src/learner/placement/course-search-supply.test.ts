import { setTimeout as delay } from "node:timers/promises";
import { prisma } from "@zoonk/db";
import { lockLearner } from "@zoonk/db/learner-writes";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { isJsonObject } from "@zoonk/utils/json";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { recordPlacementPrepared } from "../../lookahead/placement-item-skills";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { lowGuessTapItems } from "../_test-utils/placement-tap-items";
import { readPlacementAttempt } from "./_utils/placement-attempt-record";
import { getGoalPlacement } from "./get-goal-placement";
import { startPlacementSitting } from "./start-placement-sitting";

describe("preparing course placement", () => {
  it("freezes the first eligible bank only in its writer and ignores later supplies", async () => {
    const user = await userFixture();

    const { goal, plan, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [8],
      userId: user.id,
    });

    mockSession(user.id);
    const goalId = goal.id;

    const read = async () =>
      readPlacementAttempt(await prisma.goal.findUniqueOrThrow({ where: { id: goalId } })).attempt
        ?.search;

    await expect(startPlacementSitting({ goalId, input: {} })).resolves.toMatchObject({
      placement: { next: null, status: "waitingForQuestions" },
    });

    await Promise.all(skills.map((skill) => lowGuessTapItems(skill.id)));

    await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
      placement: { next: null, status: "waitingForQuestions" },
    });

    await expect(read()).resolves.toMatchObject({ topics: null });
    const held = Promise.withResolvers<number>();
    const write = Promise.withResolvers<true>();

    const edit = prisma.$transaction(async (tx) => {
      await lockLearner(tx, { userId: user.id });
      const snapshot = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
      const [connection] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
      held.resolve(connection!.pid);
      await write.promise;

      await tx.goal.update({
        data: {
          details: {
            ...(isJsonObject(snapshot.details) ? snapshot.details : {}),
            placementDeclined: false,
          },
        },
        where: { id: goalId },
      });
    });

    const owner = await held.promise;
    const freeze = recordPlacementPrepared({ goalId, planRunId: plan.runId });

    const blocked = async (): Promise<void> => {
      const [wait] = await prisma.$queryRaw<{ waiting: boolean }[]>`SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity WHERE ${owner}::int = ANY(pg_blocking_pids(pid))
      ) AS waiting`;

      if (!wait?.waiting) {
        await delay(5);

        if (!released) {
          await blocked();
        }
      }
    };

    let released = false;

    try {
      await Promise.race([freeze, blocked()]);
    } finally {
      released = true;
      write.resolve(true);
      await Promise.all([edit, freeze]);
    }

    const frozen = await read();
    expect(frozen?.topics?.length).toBe(8);

    await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
      placement: { answered: 0, status: "asking" },
    });

    await Promise.all(skills.map((skill) => lowGuessTapItems(skill.id)));
    await recordPlacementPrepared({ goalId, planRunId: plan.runId });
    await expect(read()).resolves.toStrictEqual(frozen);
  });

  it("retries an incomplete writer from the same explicit sitting", async () => {
    const user = await userFixture();

    const { goal, plan, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [4],
      userId: user.id,
    });

    mockSession(user.id);
    const goalId = goal.id;
    const open = () => startPlacementSitting({ goalId, input: {} });
    const first = await open();

    if (first.status !== "ready" || !first.placement.attempt) {
      throw new Error("Expected a preparing sitting");
    }

    await recordPlacementPrepared({ goalId, planRunId: plan.runId });

    await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
      placement: { next: null, status: "failed" },
    });

    await expect(open()).resolves.toMatchObject({
      placement: { attempt: { id: first.placement.attempt.id }, status: "waitingForQuestions" },
    });

    await Promise.all(skills.map((skill) => lowGuessTapItems(skill.id)));
    await recordPlacementPrepared({ goalId, planRunId: plan.runId });

    await expect(getGoalPlacement({ goalId })).resolves.toMatchObject({
      placement: { attempt: { id: first.placement.attempt.id }, status: "asking" },
    });
  });
});

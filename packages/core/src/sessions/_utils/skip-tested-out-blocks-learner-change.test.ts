import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import {
  LEARNER_LOCK,
  holdLearnerLock,
  waitForBlockedStatement,
} from "../../_test-utils/learner-lock";
import { skipTestedOutBlocks } from "./skip-tested-out-blocks";

async function setup() {
  const [user, lesson] = await Promise.all([userFixture(), libraryLessonFixture()]);
  const goal = await goalFixture({ userId: user.id });

  const [plan, session] = await Promise.all([
    planFixture({ goalId: goal.id }),
    studySessionFixture({ goalId: goal.id, status: "active", userId: user.id }),
  ]);

  const [item, block] = await Promise.all([
    planItemFixture({ lessonId: lesson.id, planId: plan.id }),
    studySessionBlockFixture({ lessonId: lesson.id, sessionId: session.id, status: "active" }),
  ]);

  return { block, goal, item, lesson, plan, session, user };
}

function skip(fixture: Awaited<ReturnType<typeof setup>>, notStarted = false) {
  return skipTestedOutBlocks({
    goalId: fixture.goal.id,
    notStarted,
    planItemIds: [fixture.item.id],
  });
}

describe("tested-out block skips", () => {
  it("marks a real skip without changing plan inputs and keeps a retry unchanged", async () => {
    const fixture = await setup();
    await skip(fixture);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: fixture.block.id } }),
    ).resolves.toMatchObject({ status: "skipped" });

    await skip(fixture);

    await expect(
      prisma.plan.findUniqueOrThrow({ where: { id: fixture.plan.id } }),
    ).resolves.toMatchObject({ inputVersion: fixture.plan.inputVersion });
  });

  it("takes the marker before block rows and commits one skip for concurrent requests", async () => {
    const fixture = await setup();

    const holder = holdLearnerLock({
      beforeCommit: (tx) =>
        tx.$queryRaw`SELECT id FROM study_session_blocks WHERE id = ${fixture.block.id}::uuid FOR UPDATE`,
      userId: fixture.user.id,
    });

    const pid = await holder.pid;
    const skips = Promise.all([skip(fixture), skip(fixture)]);

    try {
      await waitForBlockedStatement(pid, LEARNER_LOCK, 2);
    } finally {
      holder.release();
      await Promise.all([holder.done, skips]);
    }

    await expect(skips).resolves.toHaveLength(2);
  });
});

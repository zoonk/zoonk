import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { unplannedGoalFixture } from "../plans/_test-utils/plan-library";
import { toBlockPayload } from "./block-payload";
import { finishStudyBlock } from "./finish-study-block";

async function reviewDayFixture() {
  const [user, skill] = await Promise.all([userFixture(), skillFixture()]);
  const { goal, plan } = await unplannedGoalFixture({ timezone: "UTC", userId: user.id });

  const [items, review, session] = await Promise.all([
    Promise.all([0, 1].map(() => itemFixture({ content: choiceItemContent(), skillId: skill.id }))),
    planItemFixture({ kind: "review", planId: plan.id, skillId: skill.id }),
    studySessionFixture({
      goalId: goal.id,
      startedAt: new Date(),
      status: "active",
      userId: user.id,
    }),
  ]);

  const blocks = await Promise.all(
    items.map((item, position) =>
      studySessionBlockFixture({
        kind: "practice",
        payload: toBlockPayload({
          itemIds: [item.id],
          planItemId: review.id,
          skillIds: [skill.id],
        }),
        position,
        sessionId: session.id,
        startedAt: new Date(Date.now() - 60_000),
        status: "active",
      }),
    ),
  );

  await Promise.all(
    items.map((item) =>
      attemptFixture({
        answer: { selectedIndex: 0 },
        isCorrect: true,
        itemId: item.id,
        skillId: skill.id,
        studySessionId: session.id,
        userId: user.id,
      }),
    ),
  );

  mockSession(user.id);
  return { blocks, review, session };
}

describe("a review day split into practice blocks", () => {
  it.each([
    { first: 0, last: 1, order: "in order" },
    { first: 1, last: 0, order: "out of order" },
  ])(
    "completes its review only when its last block is finished, $order",
    async ({ first, last }) => {
      const { blocks, review, session } = await reviewDayFixture();

      const finish = (index: number) =>
        finishStudyBlock({
          blockId: blocks[index]?.id ?? "",
          input: { timeZone: "UTC" },
          sessionId: session.id,
        });

      await expect(finish(first)).resolves.toMatchObject({ status: "ready" });

      await expect(
        prisma.planItem.findUniqueOrThrow({ where: { id: review.id } }),
      ).resolves.toMatchObject({ status: "todo" });

      await expect(finish(last)).resolves.toMatchObject({ status: "ready" });

      await expect(
        prisma.planItem.findUniqueOrThrow({ where: { id: review.id } }),
      ).resolves.toMatchObject({ status: "done" });
    },
  );
});

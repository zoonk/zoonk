import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getMockPaperWriting } from "./mock-paper-writing";

const DAY_1 = { area: null, day: 1, kind: "full" } as const;
const DAY_1_PAPER = JSON.stringify(["full", 1, null]);

async function owedAsk({
  goalId,
  paper,
  userId,
}: {
  goalId: string;
  paper?: string;
  userId: string;
}) {
  return prisma.followUp.create({
    data: {
      input: { examBlueprintId: null, goalId, later: false, ...(paper && { paper }) },
      key: goalId,
      kind: "prepareMockSupply",
      userId,
    },
  });
}

describe(getMockPaperWriting, () => {
  it("names the anytime mock the learner asked for, owed while its ask hasn't ended", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      kind: "exam",
      requestedMock: { papers: [DAY_1_PAPER], shape: DAY_1 },
      userId: user.id,
    });

    mockSession(user.id);
    const ask = await owedAsk({ goalId: goal.id, paper: DAY_1_PAPER, userId: user.id });

    await expect(getMockPaperWriting({ goalId: goal.id })).resolves.toStrictEqual({
      goalId: goal.id,
      owed: true,
      paper: DAY_1_PAPER,
      status: "ready",
    });

    await prisma.followUp.delete({ where: { id: ask.id } });

    await expect(getMockPaperWriting({ goalId: goal.id })).resolves.toMatchObject({
      owed: false,
      paper: DAY_1_PAPER,
    });
  });

  it("names a scheduled mock by its day, not owed by an ask for another paper", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "exam", userId: user.id });
    const plan = await planFixture({ goalId: goal.id });
    const scheduledFor = new Date("2026-12-05T00:00:00.000Z");

    const item = await planItemFixture({
      kind: "mock",
      planId: plan.id,
      scheduledFor,
      titleSnapshot: "Mock exam",
    });

    mockSession(user.id);
    await owedAsk({ goalId: goal.id, paper: DAY_1_PAPER, userId: user.id });

    await expect(
      getMockPaperWriting({ goalId: goal.id, planItemId: item.id }),
    ).resolves.toStrictEqual({
      goalId: goal.id,
      owed: false,
      paper: scheduledFor.toISOString(),
      status: "ready",
    });
  });

  it("has no paper before the learner asks for a mock", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ kind: "exam", userId: user.id });
    mockSession(user.id);
    await owedAsk({ goalId: goal.id, userId: user.id });

    await expect(getMockPaperWriting({ goalId: goal.id })).resolves.toStrictEqual({
      goalId: goal.id,
      owed: false,
      paper: null,
      status: "ready",
    });
  });

  it("never reads another learner's goal or plan item", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);

    const [goal, ownGoal] = await Promise.all([
      goalFixture({ kind: "exam", userId: owner.id }),
      goalFixture({ kind: "exam", userId: other.id }),
    ]);

    const plan = await planFixture({ goalId: goal.id });
    const item = await planItemFixture({ kind: "mock", planId: plan.id, titleSnapshot: "Mock" });

    mockSession(other.id);

    await expect(getMockPaperWriting({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(
      getMockPaperWriting({ goalId: ownGoal.id, planItemId: item.id }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});

import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { decidePlanChange } from "../../plans/decide-plan-change";
import { learnerGoalFixture } from "../_test-utils/learner-goal";
import { placementItemBank } from "../_test-utils/placement-tap-items";
import { startPlacementSitting } from "./start-placement-sitting";

describe("released course attempts", () => {
  it("settles a released open attempt with its existing R17 evidence on the next start", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [4],
      userId: user.id,
    });

    const skillIds = skills.map((skill) => skill.id);
    const bank = await placementItemBank(skillIds);
    const id = randomUUID();
    const answeredAt = new Date();

    await prisma.goal.update({
      data: {
        details: {
          placementTest: {
            attempt: {
              estimatedMinutes: 10,
              id,
              length: "wholeCourse",
              lessonsSkipped: 0,
              part: 1,
              partComplete: false,
              partPrepared: true,
              partSkillIds: skillIds,
              partStartedAt: answeredAt.toISOString(),
              skillIds,
            },
            result: null,
          },
        },
      },
      where: { id: goal.id },
    });

    await Promise.all(
      bank
        .slice(0, 3)
        .flat()
        .map(({ item }) =>
          attemptFixture({
            answer: { placementPending: true },
            answeredAt,
            focusTestId: id,
            isPlacement: true,
            itemId: item.id,
            skillId: item.skillId,
            userId: user.id,
          }),
        ),
    );

    mockSession(user.id);

    const opened = await startPlacementSitting({
      goalId: goal.id,
      input: { length: "wholeCourse" },
    });

    expect(opened).toMatchObject({
      placement: {
        attempt: null,
        next: null,
        result: { attemptId: id, changeId: expect.any(String), lessonsSkipped: 3 },
      },
      status: "ready",
    });

    if (opened.status !== "ready" || !opened.placement.result?.changeId) {
      throw new Error("Expected an old Undo receipt");
    }

    await expect(
      decidePlanChange({
        changeId: opened.placement.result.changeId,
        goalId: goal.id,
        input: { status: "undone" },
      }),
    ).resolves.toMatchObject({ status: "updated" });

    await expect(startPlacementSitting({ goalId: goal.id, input: {} })).resolves.toMatchObject({
      placement: {
        attempt: {
          id: expect.not.stringMatching(id),
          length: "quick",
          part: 1,
          partComplete: false,
        },
      },
    });
  });
});

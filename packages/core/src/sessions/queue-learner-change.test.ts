import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "../learner/_test-utils/learner-goal";
import { SESSION_NOW, daysAgo } from "./_test-utils/session-goal";
import { addAreaPracticeBlock } from "./add-area-practice-block";
import { openStudyDay } from "./open-study-day";

async function setup() {
  const user = await userFixture();
  const day = await learnerGoalFixture({ itemsPerSkill: 20, phases: [2, 2], userId: user.id });

  await Promise.all(
    day.skills.map((skill) =>
      learnerSkillFixture({
        difficulty: 5,
        lastReviewedAt: daysAgo(3),
        reps: 2,
        skillId: skill.id,
        stability: 2,
        state: "learning",
        userId: user.id,
      }),
    ),
  );

  mockSession(user.id);

  await expect(
    openStudyDay({
      goalId: day.goal.id,
      keepEmpty: true,
      shownDate: "2026-09-30",
      timeZone: "UTC",
    }),
  ).resolves.toMatchObject({ status: "opened" });

  return { ...day, user };
}

describe("queue attempts mark freshness while preserving the queue", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => vi.useRealTimers());

  it("two taps and a replay reuse the same practice block and mark each attempt", async () => {
    const day = await setup();

    const input = {
      goalId: day.goal.id,
      input: { areaId: day.chapters[1]?.id ?? "", timeZone: "UTC" },
    };

    const results = await Promise.all([addAreaPracticeBlock(input), addAreaPracticeBlock(input)]);
    const blocks = results.flatMap((result) => (result.status === "ready" ? [result.block] : []));

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.id).toBe(blocks[1]?.id);

    await expect(addAreaPracticeBlock(input)).resolves.toMatchObject({
      block: { id: blocks[0]?.id },
      status: "ready",
    });
  });
});

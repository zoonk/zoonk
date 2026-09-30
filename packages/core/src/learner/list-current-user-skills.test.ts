import { learnerSkillFixture } from "@zoonk/testing/fixtures/learner";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { learnerGoalFixture } from "./_test-utils/learner-goal";
import { listCurrentUserSkills } from "./list-current-user-skills";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

const DAY_MS = 86_400_000;

/** A skill reviewed `daysAgo` days ago with the given stability and recall days. */
function memory({
  daysAgo,
  recallDays = 0,
  stability,
}: {
  daysAgo: number;
  recallDays?: number;
  stability: number;
}) {
  const lastReviewedAt = new Date(Date.now() - daysAgo * DAY_MS);

  return {
    difficulty: 5,
    due: new Date(lastReviewedAt.getTime() + stability * DAY_MS),
    lastReviewedAt,
    recallDays,
    reps: recallDays + 1,
    stability,
    state: recallDays >= 3 ? ("mastered" as const) : ("learning" as const),
  };
}

describe(listCurrentUserSkills, () => {
  it("requires a signed-in learner", async () => {
    mockSession(null);

    await expect(listCurrentUserSkills({})).resolves.toStrictEqual({ status: "unauthorized" });
  });

  it("hides another learner's goal", async () => {
    const [owner, other] = await Promise.all([userFixture(), userFixture()]);
    const { goal } = await learnerGoalFixture({ itemsPerSkill: 0, phases: [1], userId: owner.id });
    mockSession(other.id);

    await expect(listCurrentUserSkills({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });
  });

  it("lists every skill of a goal's plan in order, New ones included, with counts", async () => {
    const user = await userFixture();

    const { chapters, goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [2, 1],
      userId: user.id,
    });

    mockSession(user.id);

    await Promise.all([
      learnerSkillFixture({
        ...memory({ daysAgo: 1, recallDays: 3, stability: 40 }),
        skillId: skills[0]?.id ?? "",
        userId: user.id,
      }),
      learnerSkillFixture({
        ...memory({ daysAgo: 20, stability: 2 }),
        skillId: skills[1]?.id ?? "",
        userId: user.id,
      }),
    ]);

    const result = await listCurrentUserSkills({ goalId: goal.id });

    expect(result.status).toBe("ready");

    expect(result.status === "ready" && result.counts).toStrictEqual({
      fading: 1,
      learning: 1,
      mastered: 1,
      new: 1,
      solid: 0,
      total: 3,
    });

    expect(
      result.status === "ready" &&
        result.skills.map((card) => [card.name, card.state, card.fading, card.areaTitle]),
    ).toStrictEqual([
      ["Skill 1", "mastered", false, "Chapter 1"],
      ["Skill 2", "learning", true, "Chapter 1"],
      ["Skill 3", "new", false, "Chapter 2"],
    ]);

    expect(result.status === "ready" && result.skills[2]?.areaId).toBe(chapters[1]?.id);
  });

  it("filters by state or fading while counting everything", async () => {
    const user = await userFixture();

    const { goal, skills } = await learnerGoalFixture({
      itemsPerSkill: 0,
      phases: [3],
      userId: user.id,
    });

    mockSession(user.id);

    await learnerSkillFixture({
      ...memory({ daysAgo: 20, stability: 2 }),
      skillId: skills[0]?.id ?? "",
      userId: user.id,
    });

    const fading = await listCurrentUserSkills({ filter: "fading", goalId: goal.id });
    const fresh = await listCurrentUserSkills({ filter: "new", goalId: goal.id });

    expect(fading.status === "ready" && fading.skills.map((card) => card.skillId)).toStrictEqual([
      skills[0]?.id,
    ]);

    expect(fresh.status === "ready" && fresh.skills).toHaveLength(2);
    expect(fresh.status === "ready" && fresh.counts.total).toBe(3);
  });

  it("lists every skill the learner started without a goal", async () => {
    const [user, skill] = await Promise.all([
      userFixture(),
      skillFixture({ description: "Idea", example: "Example" }),
    ]);

    mockSession(user.id);

    await learnerSkillFixture({
      ...memory({ daysAgo: 0, stability: 3 }),
      skillId: skill.id,
      userId: user.id,
    });

    const result = await listCurrentUserSkills({});

    expect(result.status === "ready" && result.skills).toStrictEqual([
      expect.objectContaining({
        areaId: null,
        description: "Idea",
        example: "Example",
        skillId: skill.id,
        state: "learning",
      }),
    ]);
  });
});

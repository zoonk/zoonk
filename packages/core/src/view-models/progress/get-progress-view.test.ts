import { prisma } from "@zoonk/db";
import {
  attemptFixture,
  learnerSkillFixture,
  mistakeFixture,
} from "@zoonk/testing/fixtures/learner";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../../learner/_test-utils/learner-goal";
import { getProgressView } from "./get-progress-view";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

const daysAgo = (days: number) => new Date(Date.now() - days * MS_PER_DAY);

async function setup() {
  const user = await userFixture();
  const fixture = await learnerGoalFixture({ itemsPerSkill: 1, phases: [2, 2], userId: user.id });
  await learningProfileFixture({ activeGoalId: fixture.goal.id, userId: user.id });
  mockSession(user.id);
  return { ...fixture, user };
}

/** A skill studied long ago and not reviewed since: its memory has faded. */
function fadedSkill({ days, skillId, userId }: { days: number; skillId: string; userId: string }) {
  return Promise.all([
    learnerSkillFixture({
      createdAt: daysAgo(days),
      difficulty: 5,
      lastReviewedAt: daysAgo(days),
      recallDays: 1,
      reps: 1,
      skillId,
      stability: 1,
      state: "learning",
      userId,
    }),
    attemptFixture({ answeredAt: daysAgo(days), skillId, userId }),
  ]);
}

/** A skill remembered a week out: Solid. */
function solidSkill({ skillId, userId }: { skillId: string; userId: string }) {
  return learnerSkillFixture({
    lastReviewedAt: daysAgo(1),
    recallDays: 2,
    reps: 3,
    skillId,
    stability: 10,
    state: "solid",
    userId,
  });
}

describe(getProgressView, () => {
  it("requires a session and an own goal", async () => {
    const { goal } = await setup();

    mockSession(null);
    await expect(getProgressView()).resolves.toStrictEqual({ status: "unauthorized" });

    const other = await userFixture();
    mockSession(other.id);

    await expect(getProgressView({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(getProgressView()).resolves.toStrictEqual({ status: "noGoal" });
  });

  it("shows preparation with what's fading, and open mistakes", async () => {
    const { goal, skills, user } = await setup();

    await Promise.all([
      fadedSkill({ days: 5, skillId: skills[0]?.id ?? "", userId: user.id }),
      fadedSkill({ days: 20, skillId: skills[2]?.id ?? "", userId: user.id }),
      mistakeFixture({ skillId: skills[0]?.id ?? null, userId: user.id }),
      mistakeFixture({ skillId: skills[1]?.id ?? null, status: "fixed", userId: user.id }),
    ]);

    const result = await getProgressView();
    const progress = result.status === "ready" ? result.progress : null;

    expect(progress?.goal).toMatchObject({ id: goal.id, title: goal.title });
    expect(progress?.preparation?.goalId).toBe(goal.id);
    expect(progress?.preparation?.estimatedScore).toBeNull();
    expect(progress?.preparation?.skills).toMatchObject({ fading: 2, total: 4 });
    expect(progress?.mistakes).toStrictEqual({ open: 1 });
  });

  it("shows what's still needed by chapter, with the plan's time for it", async () => {
    const { chapters, skills, user } = await setup();

    await Promise.all([
      solidSkill({ skillId: skills[0]?.id ?? "", userId: user.id }),
      fadedSkill({ days: 2, skillId: skills[1]?.id ?? "", userId: user.id }),
    ]);

    const result = await getProgressView();
    const needed = result.status === "ready" ? result.progress.stillNeeded : null;

    expect(needed?.rule).toBe("solid");
    expect(needed?.left).toBe(3);

    expect(
      needed?.areas.map((area) => [area.areaId, area.left.map((item) => item.name), area.total]),
    ).toStrictEqual([
      [chapters[0]?.id, ["Skill 2"], 2],
      [chapters[1]?.id, ["Skill 3", "Skill 4"], 2],
    ]);

    // Without a planned graph yet, each remaining item gets the plan's average time.
    expect(needed?.areas.map((area) => area.minutes)).toStrictEqual([4, 8]);
  });

  it("asks an exam for Solid only on skills that weigh a lot, timed by the planner", async () => {
    const { goal, plan, skills, user } = await setup();

    await prisma.goal.update({ data: { kind: "exam" }, where: { id: goal.id } });

    await prisma.plan.update({
      data: {
        graph: {
          phases: [
            { milestone: null, name: "Phase 1" },
            { milestone: null, name: "Phase 2" },
          ],
          skills: skills.map((skill, index) => ({
            area: "Math",
            lessons: 1,
            name: skill.name,
            phase: index < 2 ? 0 : 1,
            skillId: skill.id,
            weight: index === 1 ? 5 : 1,
          })),
        },
      },
      where: { id: plan.id },
    });

    await Promise.all(
      skills.map((skill) => fadedSkill({ days: 2, skillId: skill.id, userId: user.id })),
    );

    const result = await getProgressView();
    const needed = result.status === "ready" ? result.progress.stillNeeded : null;

    expect(needed?.rule).toBe("examWeighted");

    expect(needed?.areas.flatMap((area) => area.left.map((item) => item.name))).toStrictEqual([
      "Skill 2",
    ]);

    expect(needed?.minutes).toBeGreaterThan(0);
  });

  it("keeps a quick explanation's progress without a preparation to show", async () => {
    const { goal } = await setup();
    await prisma.goal.update({ data: { kind: "explain" }, where: { id: goal.id } });

    const result = await getProgressView();

    expect(result).toMatchObject({
      progress: { preparation: null, stillNeeded: { areas: [], left: 0 } },
      status: "ready",
    });
  });
});

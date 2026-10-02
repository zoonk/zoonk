import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../../learner/_test-utils/learner-goal";
import { getPlanTabView } from "./get-plan-view";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

describe(getPlanTabView, () => {
  it("reads the active goal's plan with the goal's header", async () => {
    const user = await userFixture();
    const { goal, plan } = await learnerGoalFixture({ phases: [2, 1], userId: user.id });
    await learningProfileFixture({ activeGoalId: goal.id, userId: user.id });
    mockSession(user.id);

    const result = await getPlanTabView();

    expect(result).toMatchObject({
      status: "ready",
      view: { goal: { id: goal.id, kind: "learn", title: goal.title }, plan: { planId: plan.id } },
    });
  });

  it("shows the first active goal when none was picked yet, as Today does", async () => {
    const user = await userFixture();

    const [paused, active] = await Promise.all([
      learnerGoalFixture({ phases: [1], userId: user.id }),
      learnerGoalFixture({ phases: [1], userId: user.id }),
    ]);

    await prisma.goal.update({ data: { status: "paused" }, where: { id: paused.goal.id } });
    mockSession(user.id);

    await expect(getPlanTabView()).resolves.toMatchObject({
      status: "ready",
      view: { goal: { id: active.goal.id }, plan: { planId: active.plan.id } },
    });
  });

  /*
   * A huge goal plans most of each skill as one stand-in until its lessons are written. Placement
   * settles a skill it tested out, stand-in included, while the others' stand-ins still wait. The
   * settled row names its skills: the learner knows those, not the whole course.
   */
  it("keeps tested-out stand-ins apart from those still being written, never current", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ details: { placementDeclined: true }, userId: user.id });

    const [fractions, vectors, settled, waiting] = await Promise.all([
      libraryChapterFixture({ title: "Fractions" }),
      libraryChapterFixture({ title: "Vectors" }),
      skillFixture({ name: "Read a fraction as a division" }),
      skillFixture({ name: "Add vectors" }),
    ]);

    const plan = await planFixture({
      goalId: goal.id,
      graph: {
        phases: [{ milestone: null, name: "The math physics uses" }],
        skills: [settled, waiting].map((skill) => ({
          area: "Quantum physics",
          lessons: 20,
          name: skill.name,
          phase: 0,
          skillId: skill.id,
        })),
      },
      phases: [{ name: "The math physics uses" }],
    });

    await Promise.all([
      planItemFixture({
        chapterId: fractions.id,
        planId: plan.id,
        position: 0,
        status: "testedOut",
      }),
      planItemFixture({
        planId: plan.id,
        position: 1,
        skillId: settled.id,
        status: "testedOut",
        titleSnapshot: settled.name,
      }),
      planItemFixture({ chapterId: vectors.id, planId: plan.id, position: 2 }),
      planItemFixture({
        planId: plan.id,
        position: 3,
        skillId: waiting.id,
        titleSnapshot: waiting.name,
      }),
      learningProfileFixture({ activeGoalId: goal.id, userId: user.id }),
    ]);

    mockSession(user.id);

    await expect(getPlanTabView()).resolves.toMatchObject({
      status: "ready",
      view: {
        plan: {
          phases: [
            {
              chapters: [
                { skills: [], state: "done", testedOut: true, title: "Fractions", writing: false },
                {
                  skills: ["Read a fraction as a division"],
                  state: "done",
                  testedOut: true,
                  title: "Quantum physics",
                  writing: false,
                },
                {
                  skills: [],
                  state: "current",
                  testedOut: false,
                  title: "Vectors",
                  writing: false,
                },
                {
                  skills: [],
                  state: "upcoming",
                  testedOut: false,
                  title: "Quantum physics",
                  writing: true,
                },
              ],
            },
          ],
        },
      },
    });
  });

  it("says when there's no goal, no session or someone else's goal", async () => {
    const [user, other] = await Promise.all([userFixture(), userFixture()]);
    const { goal } = await learnerGoalFixture({ phases: [1], userId: other.id });

    mockSession(user.id);
    await expect(getPlanTabView()).resolves.toStrictEqual({ status: "noGoal" });

    await expect(getPlanTabView({ goalId: goal.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    mockSession(null);
    await expect(getPlanTabView()).resolves.toStrictEqual({ status: "unauthorized" });
  });
});

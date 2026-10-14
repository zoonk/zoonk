import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { learnerGoalFixture } from "../../learner/_test-utils/learner-goal";
import { signedInCourseGoal } from "../_test-utils/course-goal";
import { getPlanTabView } from "./get-plan-view";

/** Each phase's state on the active goal's plan. */
async function readStates() {
  const result = await getPlanTabView();
  return result.status === "ready" ? result.view.plan.phases.map((phase) => phase.state) : [];
}

/** The pace on the active goal's plan. */
async function readStatus() {
  const result = await getPlanTabView();
  return result.status === "ready" ? result.view.plan.status : null;
}

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

  /*
   * Pedro finished his plan, yet its last phase still read as the one he was in, "until Oct 29":
   * once nothing is left, no phase is current. One whose challenge is still ahead stays current.
   */
  it("marks no phase current once nothing is left, but keeps one whose challenge waits", async () => {
    const { goal, plan } = await signedInCourseGoal({
      statuses: ["done", "testedOut", "done", "done"],
    });

    await expect(readStates()).resolves.toStrictEqual(["done", "done"]);

    await prisma.planItem.updateMany({
      data: { status: "skipped" },
      where: { planId: plan.id, position: 3 },
    });

    // Without a date, only a lesson the Library couldn't write is set aside: nothing is left.
    await expect(readStates()).resolves.toStrictEqual(["done", "done"]);

    // With one, missed days set it aside: it's still the learner's to study.
    await prisma.goal.update({
      data: { targetDate: new Date("2099-01-01T00:00:00.000Z") },
      where: { id: goal.id },
    });

    await expect(readStates()).resolves.toStrictEqual(["done", "unfinished"]);

    await planItemFixture({ kind: "boss", phase: 1, planId: plan.id, titleSnapshot: "Challenge" });
    await expect(readStates()).resolves.toStrictEqual(["done", "current"]);
  });

  /*
   * Pedro finished his plan two weeks early, and its pace read "Ahead · 13 days ahead" beside "You
   * finished your plan". Lucas's date came with a lesson set aside: his plan read "Ended". Finished
   * comes from the work completed, and a date that came with lessons left never ends the plan.
   */
  it("reads finished pace from the work completed, and past its date with lessons left", async () => {
    const { goal, plan } = await signedInCourseGoal({ statuses: ["done", "done", "done", "done"] });
    const today = new Date();

    const items = await prisma.planItem.findMany({
      orderBy: { position: "asc" },
      where: { planId: plan.id },
    });

    await Promise.all(
      items.map((item, index) =>
        prisma.planItem.update({
          data: {
            scheduledFor: new Date(
              Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 5 + index),
            ),
          },
          where: { id: item.id },
        }),
      ),
    );

    await expect(readStatus()).resolves.toStrictEqual({ kind: "finished" });

    await Promise.all([
      prisma.planItem.updateMany({
        data: { status: "skipped" },
        where: { planId: plan.id, position: 3 },
      }),
      prisma.goal.update({
        data: {
          targetDate: new Date(
            Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1),
          ),
        },
        where: { id: goal.id },
      }),
    ]);

    await expect(readStatus()).resolves.toStrictEqual({ kind: "pastDate", lessons: 1 });
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

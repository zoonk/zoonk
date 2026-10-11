import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { courseGoalFixture, signedInCourseGoal } from "../_test-utils/course-goal";
import { getPlanTabView } from "./get-plan-view";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

async function readPlan(statuses: Parameters<typeof courseGoalFixture>[0]["statuses"]) {
  const fixture = await signedInCourseGoal({ statuses });
  const result = await getPlanTabView();
  return { ...fixture, plan: result.status === "ready" ? result.view.plan : null };
}

describe("the plan's course", () => {
  it("says which course the plan is built from, how much of it and at which level", async () => {
    const { course, organization, plan } = await readPlan(["done", "todo", "todo", "todo"]);

    expect(plan?.end).toBeNull();

    expect(plan?.course).toMatchObject({
      brandSlug: organization.slug,
      chapterCount: 3,
      courseId: course.id,
      nextLevel: "beginner",
      planChapterCount: 2,
      title: "Quantum physics",
    });

    expect(
      plan?.course?.levels.filter((level) => level.inPlan).map((level) => level.level),
    ).toStrictEqual(["overview"]);
  });

  it("is finished once every lesson was studied or tested out, and only ended with one set aside", async () => {
    const finished = await readPlan(["done", "testedOut", "testedOut", "done"]);
    expect(finished.plan?.end).toStrictEqual({ kind: "finished", setAsideLessons: 0 });

    const ended = await readPlan(["done", "skipped", "testedOut", "done"]);
    expect(ended.plan?.end).toStrictEqual({ kind: "ended", setAsideLessons: 1 });
  });

  it("has no levels or public page for a private course", async () => {
    const user = await userFixture();
    const { course, goal } = await courseGoalFixture({ userId: user.id });

    await prisma.course.update({
      data: { organizationId: null, userId: user.id, visibility: "private" },
      where: { id: course.id },
    });

    mockSession(user.id);
    const result = await getPlanTabView({ goalId: goal.id });
    const plan = result.status === "ready" ? result.view.plan : null;

    expect(plan?.course).toMatchObject({ brandSlug: null, levels: [], nextLevel: null });
  });
});

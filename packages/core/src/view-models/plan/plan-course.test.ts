import { type PlanItemStatus, prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { courseGoalFixture, signedInCourseGoal } from "../_test-utils/course-goal";
import { getPlanTabView } from "./get-plan-view";

async function readPlan() {
  const result = await getPlanTabView();
  return result.status === "ready" ? result.view.plan : null;
}

describe("the plan's course", () => {
  it("says which course the plan is built from, and is finished once every lesson was studied or tested out, never with one set aside by a date that came", async () => {
    const { course, goal, items, organization } = await signedInCourseGoal({
      statuses: ["done", "todo", "todo", "todo"],
    });

    const setStatuses = (statuses: PlanItemStatus[]) =>
      Promise.all(
        items.map((item, index) =>
          prisma.planItem.update({ data: { status: statuses[index] }, where: { id: item.id } }),
        ),
      );

    const plan = await readPlan();

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

    await setStatuses(["done", "testedOut", "testedOut", "done"]);
    const finished = await readPlan();
    expect(finished?.end).toStrictEqual({ kind: "finished" });

    await Promise.all([
      setStatuses(["done", "skipped", "testedOut", "done"]),
      prisma.goal.update({
        data: { targetDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        where: { id: goal.id },
      }),
    ]);

    const left = await readPlan();
    expect(left?.end).toBeNull();
    expect(left?.status).toStrictEqual({ kind: "pastDate", lessons: 1 });
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

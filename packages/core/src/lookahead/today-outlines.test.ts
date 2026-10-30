import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { describe, expect, it } from "vitest";
import { settleOutlineAsks } from "./today-outlines";

async function readStatuses(courseIds: string[]) {
  const courses = await prisma.course.findMany({
    select: { id: true, outlineStatus: true },
    where: { id: { in: courseIds } },
  });

  return courseIds.map((id) => courses.find((course) => course.id === id)?.outlineStatus);
}

describe(settleOutlineAsks, () => {
  it("marks the courses preparation started and puts back the ones it asked for and skipped", async () => {
    const [never, failed, stale, claimed, started] = await Promise.all([
      courseFixture({ outlineStatus: "pending" }),
      courseFixture({ outlineStatus: "pending" }),
      courseFixture({ outlineStatus: "pending" }),
      courseFixture({ outlineStatus: "running" }),
      courseFixture({ outlineStatus: "completed" }),
    ]);

    await settleOutlineAsks({
      asked: [
        { courseId: never.id, status: null },
        { courseId: failed.id, status: "failed" },
        { courseId: stale.id, status: "running" },
        { courseId: claimed.id, status: "completed" },
      ],
      started: [started.id],
    });

    await expect(
      readStatuses([never.id, failed.id, stale.id, claimed.id, started.id]),
    ).resolves.toStrictEqual([null, "failed", "failed", "running", "pending"]);
  });
});

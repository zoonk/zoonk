import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { privateCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { type Page, expect, test } from "./fixtures";

type PrivateCourse = Awaited<ReturnType<typeof privateCourseFixture>>;

/** The owner starts the course from its start page; anyone else finds no such page. */
async function expectOwnerOnly({
  course: { chapters, course },
  owner,
  viewers,
}: {
  course: PrivateCourse;
  owner: Page;
  viewers: Page[];
}) {
  const path = `/start/course/${course.id}`;
  await owner.goto(path);

  await expect(owner.getByRole("heading", { name: "How much do you already know?" })).toBeVisible();
  await expect(owner.getByRole("main").getByText(course.title, { exact: true })).toBeVisible();
  await expect(owner).toHaveTitle(new RegExp(course.title, "u"));

  await Promise.all(
    viewers.map(async (viewer) => {
      await viewer.goto(path);

      await expect(
        viewer.getByRole("heading", { name: "We couldn't find this page" }),
      ).toBeVisible();

      await expect(viewer).not.toHaveTitle(new RegExp(course.title, "u"));
      expect(await viewer.content()).not.toContain(course.title);
      expect(await viewer.content()).not.toContain(chapters[0]!.title);
      await expect(viewer.getByRole("button", { name: "Build my plan" })).toHaveCount(0);
    }),
  );
}

test.describe("Private course start authorization", () => {
  test("keeps the start page and metadata owner-only, published or not", async ({
    authenticatedPage,
    noProgressUser,
    page,
    userWithoutProgress: owner,
  }) => {
    // The page starts a published course or the learner's own private one: both reach the owner.
    const courses = await Promise.all(
      [false, true].map((isPublished) =>
        privateCourseFixture({
          isPublished,
          ownerId: noProgressUser.id,
          title: `Private course ${randomUUID()}`,
        }),
      ),
    );

    for (const course of courses) {
      // oxlint-disable-next-line no-await-in-loop -- The same pages open one course at a time.
      await expectOwnerOnly({ course, owner, viewers: [authenticatedPage, page] });
    }

    await expect(
      prisma.goal.count({
        where: { primaryCourseId: { in: courses.map(({ course }) => course.id) } },
      }),
    ).resolves.toBe(0);
  });
});

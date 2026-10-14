import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { privateCourseFixture } from "@zoonk/testing/fixtures/library-courses";
import { expect, test } from "./fixtures";

test.describe("Private course start authorization", () => {
  for (const isPublished of [false, true]) {
    test(`keeps the start page and metadata owner-only (published: ${isPublished})`, async ({
      authenticatedPage,
      noProgressUser,
      page,
      userWithoutProgress: ownerPage,
    }) => {
      const { chapters, course } = await privateCourseFixture({
        isPublished,
        ownerId: noProgressUser.id,
        title: `Private course ${randomUUID()}`,
      });

      const path = `/start/course/${course.id}`;
      await ownerPage.goto(path);

      await expect(
        ownerPage.getByRole("heading", { name: "How much do you already know?" }),
      ).toBeVisible();

      await expect(
        ownerPage.getByRole("main").getByText(course.title, { exact: true }),
      ).toBeVisible();

      await expect(ownerPage).toHaveTitle(new RegExp(course.title, "u"));

      await Promise.all(
        [authenticatedPage, page].map(async (viewer) => {
          await viewer.goto(path);

          await expect(
            viewer.getByRole("heading", { name: "We couldn't find this page" }),
          ).toBeVisible();

          await expect(viewer).not.toHaveTitle(new RegExp(course.title, "u"));
          expect(await viewer.content()).not.toContain(course.title);
          expect(await viewer.content()).not.toContain(chapters[0]!.title);
          await expect(viewer.getByRole("button", { name: "Build my plan" })).toHaveCount(0);

          await viewer.goto(`/start/course/${randomUUID()}`);

          await expect(
            viewer.getByRole("heading", { name: "We couldn't find this page" }),
          ).toBeVisible();
        }),
      );

      await expect(prisma.goal.count({ where: { primaryCourseId: course.id } })).resolves.toBe(0);
    });
  }
});

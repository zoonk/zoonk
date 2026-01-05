import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import tmp from "tmp";
import { expect, type Page, test } from "./fixtures";
import { getMoreOptionsButton, importFlow } from "./helpers/import-dialog";

function createImportFile(
  lessons: { title: string; description: string }[],
): string {
  const content = JSON.stringify({ lessons }, null, 2);
  const tmpFile = tmp.fileSync({ postfix: ".json", prefix: "lessons-" });
  fs.writeFileSync(tmpFile.name, content);
  return tmpFile.name;
}

async function createTestChapter(lessonCount = 0) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  const course = await courseFixture({
    organizationId: org.id,
    slug: `e2e-ls-${randomUUID().slice(0, 8)}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    language: "en",
    organizationId: org.id,
    position: 0,
    slug: `e2e-ch-${randomUUID().slice(0, 8)}`,
    title: "Test Chapter",
  });

  const lessons =
    lessonCount > 0
      ? await Promise.all(
          Array.from({ length: lessonCount }, (_, i) =>
            lessonFixture({
              chapterId: chapter.id,
              language: "en",
              organizationId: org.id,
              position: i,
              title: `Lesson ${i + 1}`,
            }),
          ),
        )
      : [];

  return { chapter, course, lessons, org };
}

async function navigateToChapterPage(
  page: Page,
  courseSlug: string,
  chapterSlug: string,
) {
  await page.goto(`/ai/c/en/${courseSlug}/ch/${chapterSlug}`);

  await expect(
    page.getByRole("textbox", { name: /edit chapter title/i }),
  ).toBeVisible();
}

async function expectLessonsVisible(
  page: Page,
  lessons: { position: number; title: string }[],
) {
  await Promise.all(
    lessons.map(({ position, title }) =>
      expect(
        page.getByRole("link", {
          name: new RegExp(
            `^${String(position).padStart(2, "0")}.*${title}`,
            "i",
          ),
        }),
      ).toBeVisible(),
    ),
  );
}

async function expectLessonNotVisible(page: Page, title: string) {
  await expect(
    page.getByRole("link", { name: new RegExp(title, "i") }),
  ).not.toBeVisible();
}

test.describe("Lesson List", () => {
  test.describe("Display", () => {
    test("displays existing lessons with position and title", async ({
      authenticatedPage,
    }) => {
      const { chapter, course } = await createTestChapter(3);

      await navigateToChapterPage(authenticatedPage, course.slug, chapter.slug);

      await expectLessonsVisible(authenticatedPage, [
        { position: 1, title: "Lesson 1" },
        { position: 2, title: "Lesson 2" },
        { position: 3, title: "Lesson 3" },
      ]);
    });

    test("displays lesson description when available", async ({
      authenticatedPage,
    }) => {
      const { chapter, course, org } = await createTestChapter();
      const uniqueDesc = `Description ${randomUUID().slice(0, 8)}`;

      await lessonFixture({
        chapterId: chapter.id,
        description: uniqueDesc,
        language: "en",
        organizationId: org.id,
        position: 0,
        title: "Lesson with description",
      });

      await navigateToChapterPage(authenticatedPage, course.slug, chapter.slug);

      await expect(authenticatedPage.getByText(uniqueDesc)).toBeVisible();
    });
  });

  test.describe("Add Lesson", () => {
    test("adds a lesson and shows lesson edit page", async ({
      authenticatedPage,
    }) => {
      const { chapter, course } = await createTestChapter();

      await navigateToChapterPage(authenticatedPage, course.slug, chapter.slug);

      await authenticatedPage
        .getByRole("button", { name: /add lesson/i })
        .click();

      // Verify destination page content (not just URL)
      await expect(
        authenticatedPage.getByRole("textbox", { name: /edit lesson title/i }),
      ).toBeVisible();

      // Verify the default title is set
      await expect(
        authenticatedPage.getByRole("textbox", { name: /edit lesson title/i }),
      ).toHaveValue(/untitled lesson/i);
    });

    test("inserts lesson at middle position", async ({ authenticatedPage }) => {
      const { chapter, course } = await createTestChapter(4);

      await navigateToChapterPage(authenticatedPage, course.slug, chapter.slug);

      await expectLessonsVisible(authenticatedPage, [
        { position: 1, title: "Lesson 1" },
        { position: 2, title: "Lesson 2" },
        { position: 3, title: "Lesson 3" },
        { position: 4, title: "Lesson 4" },
      ]);

      // Hover over the third lesson to reveal the insert button between 2 and 3
      const thirdLessonItem = authenticatedPage.getByRole("link", {
        name: /^03.*Lesson 3/i,
      });

      await thirdLessonItem.hover();

      // Click the insert button that appears before lesson 3 (position 2)
      const insertButtons = authenticatedPage.getByRole("button", {
        name: /insert lesson/i,
      });

      await insertButtons.nth(2).click();

      // After clicking insert, we're redirected to the lesson edit page
      await expect(
        authenticatedPage.getByRole("textbox", { name: /edit lesson title/i }),
      ).toBeVisible();

      // Navigate back to chapter page to verify insertion
      await authenticatedPage.goto(
        `/ai/c/en/${course.slug}/ch/${chapter.slug}`,
      );

      await expect(
        authenticatedPage.getByRole("textbox", { name: /edit chapter title/i }),
      ).toBeVisible();

      // New lesson should be at position 3, shifting lessons 3 and 4 down
      await expectLessonsVisible(authenticatedPage, [
        { position: 1, title: "Lesson 1" },
        { position: 2, title: "Lesson 2" },
        { position: 3, title: "Untitled lesson" },
        { position: 4, title: "Lesson 3" },
        { position: 5, title: "Lesson 4" },
      ]);
    });
  });

  test.describe("Reorder", () => {
    test("reorders lessons and persists after reload", async ({
      authenticatedPage,
    }) => {
      const { chapter, course } = await createTestChapter(3);

      await navigateToChapterPage(authenticatedPage, course.slug, chapter.slug);

      await expectLessonsVisible(authenticatedPage, [
        { position: 1, title: "Lesson 1" },
        { position: 2, title: "Lesson 2" },
        { position: 3, title: "Lesson 3" },
      ]);

      // Get the inner drag handle buttons (exact name match to avoid outer container buttons)
      const firstHandle = authenticatedPage
        .getByRole("button", { exact: true, name: "Drag to reorder" })
        .first();

      const secondHandle = authenticatedPage
        .getByRole("button", { exact: true, name: "Drag to reorder" })
        .nth(1);

      const firstBox = await firstHandle.boundingBox();
      const secondBox = await secondHandle.boundingBox();

      if (!(firstBox && secondBox)) {
        throw new Error("Drag handle bounding boxes should exist");
      }

      // Perform drag past 8px activation threshold
      await firstHandle.hover();
      await authenticatedPage.mouse.down();

      const targetY = secondBox.y + secondBox.height / 2 + 5;

      await authenticatedPage.mouse.move(
        firstBox.x + firstBox.width / 2,
        firstBox.y + 20,
        { steps: 5 },
      );

      await authenticatedPage.mouse.move(
        firstBox.x + firstBox.width / 2,
        targetY,
        { steps: 10 },
      );

      await authenticatedPage.mouse.up();

      // After reorder: Lesson 1 moves from first to second position
      const reorderedLessons = [
        { position: 1, title: "Lesson 2" },
        { position: 2, title: "Lesson 1" },
        { position: 3, title: "Lesson 3" },
      ];

      await expectLessonsVisible(authenticatedPage, reorderedLessons);

      // Reload and verify persistence
      await authenticatedPage.reload();

      await expect(
        authenticatedPage.getByRole("textbox", { name: /edit chapter title/i }),
      ).toBeVisible();

      await expectLessonsVisible(authenticatedPage, reorderedLessons);
    });
  });

  test.describe("Import/Export", () => {
    test("exports lessons as JSON file", async ({ authenticatedPage }) => {
      const { chapter, course, lessons } = await createTestChapter(2);

      await navigateToChapterPage(authenticatedPage, course.slug, chapter.slug);

      await getMoreOptionsButton(authenticatedPage).click();

      const downloadPromise = authenticatedPage.waitForEvent("download");

      await authenticatedPage
        .getByRole("menuitem", { name: /export/i })
        .click();

      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe("lessons.json");

      const downloadPath = await download.path();

      if (!downloadPath) {
        throw new Error("Download path should exist");
      }

      const json = JSON.parse(fs.readFileSync(downloadPath, "utf-8"));
      expect(json.lessons).toHaveLength(lessons.length);

      // Verify actual content, not just count
      const exportedTitles = json.lessons.map(
        (l: { title: string }) => l.title,
      );
      expect(exportedTitles).toContain("Lesson 1");
      expect(exportedTitles).toContain("Lesson 2");
    });

    test("imports lessons in merge mode", async ({ authenticatedPage }) => {
      const { chapter, course, lessons } = await createTestChapter(1);
      const existingTitle = lessons[0]?.title ?? "";

      const prefix = randomUUID().slice(0, 8);
      const importedTitle1 = `Imported ${prefix} 1`;
      const importedTitle2 = `Imported ${prefix} 2`;

      const importFile = createImportFile([
        { description: "First imported", title: importedTitle1 },
        { description: "Second imported", title: importedTitle2 },
      ]);

      try {
        await navigateToChapterPage(
          authenticatedPage,
          course.slug,
          chapter.slug,
        );

        await expect(
          authenticatedPage.getByRole("link", { name: existingTitle }),
        ).toBeVisible();

        await importFlow(authenticatedPage, importFile, "merge");

        // Verify all lessons are visible (existing + imported)
        await expect(
          authenticatedPage.getByRole("link", { name: existingTitle }),
        ).toBeVisible();

        await expect(
          authenticatedPage.getByRole("link", { name: importedTitle1 }),
        ).toBeVisible();

        await expect(
          authenticatedPage.getByRole("link", { name: importedTitle2 }),
        ).toBeVisible();

        // Verify persistence after reload
        await authenticatedPage.reload();

        await expect(
          authenticatedPage.getByRole("textbox", {
            name: /edit chapter title/i,
          }),
        ).toBeVisible();

        await expect(
          authenticatedPage.getByRole("link", { name: existingTitle }),
        ).toBeVisible();

        await expect(
          authenticatedPage.getByRole("link", { name: importedTitle1 }),
        ).toBeVisible();

        await expect(
          authenticatedPage.getByRole("link", { name: importedTitle2 }),
        ).toBeVisible();
      } finally {
        fs.unlinkSync(importFile);
      }
    });

    test("imports lessons in replace mode", async ({ authenticatedPage }) => {
      const { chapter, course, lessons } = await createTestChapter(1);
      const existingTitle = lessons[0]?.title ?? "";

      const prefix = randomUUID().slice(0, 8);
      const importedTitle1 = `Replaced ${prefix} 1`;
      const importedTitle2 = `Replaced ${prefix} 2`;

      const importFile = createImportFile([
        { description: "First replaced", title: importedTitle1 },
        { description: "Second replaced", title: importedTitle2 },
      ]);

      try {
        await navigateToChapterPage(
          authenticatedPage,
          course.slug,
          chapter.slug,
        );

        await expect(
          authenticatedPage.getByRole("link", { name: existingTitle }),
        ).toBeVisible();

        await importFlow(authenticatedPage, importFile, "replace");

        // Existing lesson should be removed
        await expectLessonNotVisible(authenticatedPage, existingTitle);

        // Only imported lessons should be visible
        await expect(
          authenticatedPage.getByRole("link", { name: importedTitle1 }),
        ).toBeVisible();

        await expect(
          authenticatedPage.getByRole("link", { name: importedTitle2 }),
        ).toBeVisible();

        // Verify persistence after reload
        await authenticatedPage.reload();

        await expect(
          authenticatedPage.getByRole("textbox", {
            name: /edit chapter title/i,
          }),
        ).toBeVisible();

        await expectLessonNotVisible(authenticatedPage, existingTitle);

        await expect(
          authenticatedPage.getByRole("link", { name: importedTitle1 }),
        ).toBeVisible();

        await expect(
          authenticatedPage.getByRole("link", { name: importedTitle2 }),
        ).toBeVisible();
      } finally {
        fs.unlinkSync(importFile);
      }
    });
  });
});

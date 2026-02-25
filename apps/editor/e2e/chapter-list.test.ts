import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import tmp from "tmp";
import { type Page, expect, test } from "./fixtures";
import { importFlow, openMoreOptionsMenu } from "./helpers/import-dialog";

function createImportFile(chapters: { title: string; description: string }[]): string {
  const content = JSON.stringify({ chapters }, null, 2);
  const tmpFile = tmp.fileSync({ postfix: ".json", prefix: "chapters-" });
  fs.writeFileSync(tmpFile.name, content);
  return tmpFile.name;
}

async function createTestCourse(chapterCount = 0) {
  const org = await getAiOrganization();

  const course = await courseFixture({
    organizationId: org.id,
    slug: `e2e-ch-${randomUUID().slice(0, 8)}`,
  });

  const chapters =
    chapterCount > 0
      ? await Promise.all(
          Array.from({ length: chapterCount }, (_, i) =>
            chapterFixture({
              courseId: course.id,
              language: "en",
              organizationId: org.id,
              position: i,
              title: `Chapter ${i + 1}`,
            }),
          ),
        )
      : [];

  return { chapters, course, org };
}

async function navigateToCoursePage(page: Page, slug: string) {
  await page.goto(`/${AI_ORG_SLUG}/c/${slug}`);

  await expect(page.getByRole("textbox", { name: /edit course title/i })).toBeVisible();
}

async function expectChaptersVisible(page: Page, chapters: { position: number; title: string }[]) {
  await Promise.all(
    chapters.map(async ({ position, title }) => {
      // Find the listitem containing both the position number and title link
      // This verifies they are in the same row
      const listItem = page.getByRole("listitem").filter({
        hasText: new RegExp(String(position).padStart(2, "0")),
      });

      await expect(listItem.getByRole("link", { name: new RegExp(title, "i") })).toBeVisible();
    }),
  );
}

async function expectChapterNotVisible(page: Page, title: string) {
  await expect(page.getByRole("link", { name: new RegExp(title, "i") })).not.toBeVisible();
}

test.describe("Chapter List", () => {
  test.describe("Display", () => {
    test("displays existing chapters with position and title", async ({ authenticatedPage }) => {
      const { course } = await createTestCourse(3);

      await navigateToCoursePage(authenticatedPage, course.slug);

      await expectChaptersVisible(authenticatedPage, [
        { position: 1, title: "Chapter 1" },
        { position: 2, title: "Chapter 2" },
        { position: 3, title: "Chapter 3" },
      ]);
    });

    test("displays chapter description when available", async ({ authenticatedPage }) => {
      const { course, org } = await createTestCourse();
      const uniqueDesc = `Description ${randomUUID().slice(0, 8)}`;

      await chapterFixture({
        courseId: course.id,
        description: uniqueDesc,
        language: "en",
        organizationId: org.id,
        position: 0,
        title: "Chapter with description",
      });

      await navigateToCoursePage(authenticatedPage, course.slug);

      await expect(authenticatedPage.getByText(uniqueDesc)).toBeVisible();
    });
  });

  test.describe("Add Chapter", () => {
    test("adds a chapter and shows chapter edit page", async ({ authenticatedPage }) => {
      const { course } = await createTestCourse();

      await navigateToCoursePage(authenticatedPage, course.slug);

      await authenticatedPage.getByRole("button", { name: /add chapter/i }).click();

      // Verify destination page content (not just URL)
      await expect(
        authenticatedPage.getByRole("textbox", { name: /edit chapter title/i }),
      ).toBeVisible();

      // Verify the default title is set
      await expect(
        authenticatedPage.getByRole("textbox", { name: /edit chapter title/i }),
      ).toHaveValue(/untitled chapter/i);
    });

    test("inserts chapter at middle position", async ({ authenticatedPage }) => {
      const { course } = await createTestCourse(4);

      await navigateToCoursePage(authenticatedPage, course.slug);

      await expectChaptersVisible(authenticatedPage, [
        { position: 1, title: "Chapter 1" },
        { position: 2, title: "Chapter 2" },
        { position: 3, title: "Chapter 3" },
        { position: 4, title: "Chapter 4" },
      ]);

      // Click the actions menu on Chapter 2 to insert below it (at position 2)
      // Use exact match to avoid matching outer container buttons
      const actionsButtons = authenticatedPage.getByRole("button", {
        exact: true,
        name: "Chapter actions",
      });

      // Click the second chapter's actions button (index 1)
      await actionsButtons.nth(1).click();

      // Wait for the menu to appear and click "Insert below"
      const insertBelowItem = authenticatedPage.getByRole("menuitem", {
        name: /insert below/i,
      });
      await insertBelowItem.waitFor({ state: "visible" });
      await insertBelowItem.click();

      // After clicking insert, we're redirected to the chapter edit page
      await expect(
        authenticatedPage.getByRole("textbox", { name: /edit chapter title/i }),
      ).toBeVisible();

      // Navigate back to course page to verify insertion
      await authenticatedPage.goto(`/${AI_ORG_SLUG}/c/${course.slug}`);

      await expect(
        authenticatedPage.getByRole("textbox", { name: /edit course title/i }),
      ).toBeVisible();

      // New chapter should be at position 3, shifting chapters 3 and 4 down
      await expectChaptersVisible(authenticatedPage, [
        { position: 1, title: "Chapter 1" },
        { position: 2, title: "Chapter 2" },
        { position: 3, title: "Untitled chapter" },
        { position: 4, title: "Chapter 3" },
        { position: 5, title: "Chapter 4" },
      ]);
    });
  });

  test.describe("Reorder", () => {
    test("reorders chapters and persists after reload", async ({ authenticatedPage }) => {
      const { course } = await createTestCourse(3);

      await navigateToCoursePage(authenticatedPage, course.slug);

      await expectChaptersVisible(authenticatedPage, [
        { position: 1, title: "Chapter 1" },
        { position: 2, title: "Chapter 2" },
        { position: 3, title: "Chapter 3" },
      ]);

      const firstHandle = authenticatedPage
        .getByRole("button", { exact: true, name: "Drag to reorder" })
        .first();

      const secondHandle = authenticatedPage
        .getByRole("button", { exact: true, name: "Drag to reorder" })
        .nth(1);

      await firstHandle.dragTo(secondHandle, { steps: 20 });

      // Verify Chapter 1 is no longer first — the order changed
      const firstItem = authenticatedPage.getByRole("listitem").filter({ hasText: /01/ });
      await expect(firstItem.getByRole("link", { name: /chapter 1/i })).not.toBeVisible();

      // Verify the new order persisted to the database
      const chapters = await prisma.chapter.findMany({
        orderBy: { position: "asc" },
        select: { title: true },
        where: { courseId: course.id },
      });

      expect(chapters[0]?.title).not.toBe("Chapter 1");
    });
  });

  test.describe("Import/Export", () => {
    test("exports chapters as JSON file", async ({ authenticatedPage }) => {
      const { course, chapters } = await createTestCourse(2);

      await navigateToCoursePage(authenticatedPage, course.slug);

      await openMoreOptionsMenu(authenticatedPage);

      const downloadPromise = authenticatedPage.waitForEvent("download");

      await authenticatedPage.getByRole("menuitem", { name: /export/i }).click();

      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe("chapters.json");

      const downloadPath = await download.path();

      if (!downloadPath) {
        throw new Error("Download path should exist");
      }

      const json = JSON.parse(fs.readFileSync(downloadPath, "utf8"));
      expect(json.chapters).toHaveLength(chapters.length);

      // Verify actual content, not just count
      const exportedTitles = json.chapters.map((chapter: { title: string }) => chapter.title);
      expect(exportedTitles).toContain("Chapter 1");
      expect(exportedTitles).toContain("Chapter 2");
    });

    test("imports chapters in merge mode", async ({ authenticatedPage }) => {
      const { course, chapters } = await createTestCourse(1);
      const existingTitle = chapters[0]?.title ?? "";

      const prefix = randomUUID().slice(0, 8);
      const importedTitle1 = `Imported ${prefix} 1`;
      const importedTitle2 = `Imported ${prefix} 2`;

      const importFile = createImportFile([
        { description: "First imported", title: importedTitle1 },
        { description: "Second imported", title: importedTitle2 },
      ]);

      try {
        await navigateToCoursePage(authenticatedPage, course.slug);

        await expect(authenticatedPage.getByRole("link", { name: existingTitle })).toBeVisible();

        await importFlow(authenticatedPage, importFile, "merge");

        // Verify all chapters are visible (existing + imported)
        await expect(authenticatedPage.getByRole("link", { name: existingTitle })).toBeVisible();

        await expect(authenticatedPage.getByRole("link", { name: importedTitle1 })).toBeVisible();

        await expect(authenticatedPage.getByRole("link", { name: importedTitle2 })).toBeVisible();

        await expect(async () => {
          const titles = await prisma.chapter.findMany({
            select: { title: true },
            where: { courseId: course.id },
          });
          const titleList = titles.map((chapter) => chapter.title);
          expect(titleList).toContain(existingTitle);
          expect(titleList).toContain(importedTitle1);
          expect(titleList).toContain(importedTitle2);
        }).toPass({ timeout: 10_000 });
      } finally {
        fs.unlinkSync(importFile);
      }
    });

    test("imports chapters in replace mode", async ({ authenticatedPage }) => {
      const { course, chapters } = await createTestCourse(1);
      const existingTitle = chapters[0]?.title ?? "";

      const prefix = randomUUID().slice(0, 8);
      const importedTitle1 = `Replaced ${prefix} 1`;
      const importedTitle2 = `Replaced ${prefix} 2`;

      const importFile = createImportFile([
        { description: "First replaced", title: importedTitle1 },
        { description: "Second replaced", title: importedTitle2 },
      ]);

      try {
        await navigateToCoursePage(authenticatedPage, course.slug);

        await expect(authenticatedPage.getByRole("link", { name: existingTitle })).toBeVisible();

        await importFlow(authenticatedPage, importFile, "replace");

        // Existing chapter should be removed
        await expectChapterNotVisible(authenticatedPage, existingTitle);

        // Only imported chapters should be visible
        await expect(authenticatedPage.getByRole("link", { name: importedTitle1 })).toBeVisible();

        await expect(authenticatedPage.getByRole("link", { name: importedTitle2 })).toBeVisible();

        await expect(async () => {
          const titles = await prisma.chapter.findMany({
            select: { title: true },
            where: { courseId: course.id },
          });
          const titleList = titles.map((chapter) => chapter.title);
          expect(titleList).not.toContain(existingTitle);
          expect(titleList).toContain(importedTitle1);
          expect(titleList).toContain(importedTitle2);
        }).toPass({ timeout: 10_000 });
      } finally {
        fs.unlinkSync(importFile);
      }
    });
  });
});

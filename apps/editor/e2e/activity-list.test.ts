import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { prisma } from "@zoonk/db";
import { getAiOrganization } from "@zoonk/e2e/helpers";
import { activityFixture } from "@zoonk/testing/fixtures/activities";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import tmp from "tmp";
import { type Page, expect, test } from "./fixtures";
import { importFlow, openMoreOptionsMenu } from "./helpers/import-dialog";

function createImportFile(
  activities: { description?: string; kind: string; title?: string }[],
): string {
  const content = JSON.stringify({ activities }, null, 2);
  const tmpFile = tmp.fileSync({ postfix: ".json", prefix: "activities-" });
  fs.writeFileSync(tmpFile.name, content);
  return tmpFile.name;
}

async function createTestLesson(activityCount = 0) {
  const org = await getAiOrganization();

  const course = await courseFixture({
    organizationId: org.id,
    slug: `e2e-ac-${randomUUID().slice(0, 8)}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    language: "en",
    organizationId: org.id,
    position: 0,
    slug: `e2e-ch-${randomUUID().slice(0, 8)}`,
    title: "Test Chapter",
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    language: "en",
    organizationId: org.id,
    position: 0,
    slug: `e2e-ls-${randomUUID().slice(0, 8)}`,
    title: "Test Lesson",
  });

  const activities =
    activityCount > 0
      ? await Promise.all(
          Array.from({ length: activityCount }, (_, i) =>
            activityFixture({
              language: "en",
              lessonId: lesson.id,
              organizationId: org.id,
              position: i,
              title: `Activity ${i + 1}`,
            }),
          ),
        )
      : [];

  return { activities, chapter, course, lesson, org };
}

async function navigateToLessonPage(
  page: Page,
  courseSlug: string,
  chapterSlug: string,
  lessonSlug: string,
) {
  await page.goto(`/${AI_ORG_SLUG}/c/${courseSlug}/ch/${chapterSlug}/l/${lessonSlug}`);

  await expect(page.getByRole("textbox", { name: /edit lesson title/i })).toBeVisible();
}

async function expectActivitiesVisible(
  page: Page,
  activities: { position: number; title: string }[],
) {
  await Promise.all(
    activities.map(async ({ position, title }) => {
      const listItem = page.getByRole("listitem").filter({
        hasText: new RegExp(String(position).padStart(2, "0")),
      });

      await expect(listItem.getByRole("link", { name: new RegExp(title, "i") })).toBeVisible();
    }),
  );
}

async function expectActivityNotVisible(page: Page, title: string) {
  await expect(page.getByRole("link", { name: new RegExp(title, "i") })).not.toBeVisible();
}

test.describe("Activity List", () => {
  test.describe("Display", () => {
    test("displays existing activities with position and title", async ({ authenticatedPage }) => {
      const { chapter, course, lesson } = await createTestLesson(3);

      await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

      await expectActivitiesVisible(authenticatedPage, [
        { position: 1, title: "Activity 1" },
        { position: 2, title: "Activity 2" },
        { position: 3, title: "Activity 3" },
      ]);
    });

    test("displays activity description when available", async ({ authenticatedPage }) => {
      const { chapter, course, lesson, org } = await createTestLesson();
      const uniqueDesc = `Description ${randomUUID().slice(0, 8)}`;

      await activityFixture({
        description: uniqueDesc,
        language: "en",
        lessonId: lesson.id,
        organizationId: org.id,
        position: 0,
        title: "Activity with description",
      });

      await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

      await expect(authenticatedPage.getByText(uniqueDesc)).toBeVisible();
    });
  });

  test.describe("Add Activity", () => {
    test("adds an activity and shows activity edit page", async ({ authenticatedPage }) => {
      const { chapter, course, lesson } = await createTestLesson();

      await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

      await authenticatedPage.getByRole("button", { name: /add activity/i }).click();

      await expect(authenticatedPage.getByText(/activity editor coming soon/i)).toBeVisible();
    });

    test("inserts activity at middle position", async ({ authenticatedPage }) => {
      const { chapter, course, lesson } = await createTestLesson(4);

      await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

      await expectActivitiesVisible(authenticatedPage, [
        { position: 1, title: "Activity 1" },
        { position: 2, title: "Activity 2" },
        { position: 3, title: "Activity 3" },
        { position: 4, title: "Activity 4" },
      ]);

      const actionsButtons = authenticatedPage.getByRole("button", {
        exact: true,
        name: "Activity actions",
      });

      await actionsButtons.nth(1).click();

      const insertBelowItem = authenticatedPage.getByRole("menuitem", {
        name: /insert below/i,
      });
      await insertBelowItem.waitFor({ state: "visible" });
      await insertBelowItem.click();

      await expect(authenticatedPage.getByText(/activity editor coming soon/i)).toBeVisible();

      await authenticatedPage.goto(
        `/${AI_ORG_SLUG}/c/${course.slug}/ch/${chapter.slug}/l/${lesson.slug}`,
      );

      await expect(
        authenticatedPage.getByRole("textbox", { name: /edit lesson title/i }),
      ).toBeVisible();

      await expectActivitiesVisible(authenticatedPage, [
        { position: 1, title: "Activity 1" },
        { position: 2, title: "Activity 2" },
        { position: 3, title: "Untitled activity" },
        { position: 4, title: "Activity 3" },
        { position: 5, title: "Activity 4" },
      ]);
    });
  });

  test.describe("Reorder", () => {
    test("reorders activities and persists after reload", async ({ authenticatedPage }) => {
      const { chapter, course, lesson } = await createTestLesson(3);

      await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

      await expectActivitiesVisible(authenticatedPage, [
        { position: 1, title: "Activity 1" },
        { position: 2, title: "Activity 2" },
        { position: 3, title: "Activity 3" },
      ]);

      const firstHandle = authenticatedPage
        .getByRole("button", { exact: true, name: "Drag to reorder" })
        .first();

      const secondHandle = authenticatedPage
        .getByRole("button", { exact: true, name: "Drag to reorder" })
        .nth(1);

      await firstHandle.dragTo(secondHandle, { steps: 10 });

      const reorderedActivities = [
        { position: 1, title: "Activity 2" },
        { position: 2, title: "Activity 1" },
        { position: 3, title: "Activity 3" },
      ];

      await expectActivitiesVisible(authenticatedPage, reorderedActivities);

      await expect(async () => {
        const activities = await prisma.activity.findMany({
          orderBy: { position: "asc" },
          select: { position: true, title: true },
          where: { lessonId: lesson.id },
        });

        expect(activities).toEqual(
          reorderedActivities.map(({ position, title }) => ({ position: position - 1, title })),
        );
      }).toPass({ timeout: 10_000 });
    });
  });

  test.describe("Import/Export", () => {
    test("exports activities as JSON file", async ({ authenticatedPage }) => {
      const { activities, chapter, course, lesson } = await createTestLesson(2);

      await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

      await openMoreOptionsMenu(authenticatedPage);

      const downloadPromise = authenticatedPage.waitForEvent("download");

      await authenticatedPage.getByRole("menuitem", { name: /export/i }).click();

      const download = await downloadPromise;

      expect(download.suggestedFilename()).toBe("activities.json");

      const downloadPath = await download.path();

      if (!downloadPath) {
        throw new Error("Download path should exist");
      }

      const json = JSON.parse(fs.readFileSync(downloadPath, "utf8"));
      expect(json.activities).toHaveLength(activities.length);

      const exportedTitles = json.activities.map((a: { title: string }) => a.title);
      expect(exportedTitles).toContain("Activity 1");
      expect(exportedTitles).toContain("Activity 2");
    });

    test("imports activities in merge mode", async ({ authenticatedPage }) => {
      const { activities, chapter, course, lesson } = await createTestLesson(1);
      const existingTitle = activities[0]?.title ?? "";

      const prefix = randomUUID().slice(0, 8);
      const importedTitle1 = `Imported ${prefix} 1`;
      const importedTitle2 = `Imported ${prefix} 2`;

      const importFile = createImportFile([
        { kind: "background", title: importedTitle1 },
        { kind: "quiz", title: importedTitle2 },
      ]);

      try {
        await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

        await expect(authenticatedPage.getByRole("link", { name: existingTitle })).toBeVisible();

        await importFlow(authenticatedPage, importFile, "merge");

        await expect(authenticatedPage.getByRole("link", { name: existingTitle })).toBeVisible();

        await expect(authenticatedPage.getByRole("link", { name: importedTitle1 })).toBeVisible();

        await expect(authenticatedPage.getByRole("link", { name: importedTitle2 })).toBeVisible();

        await expect(async () => {
          const titles = await prisma.activity.findMany({
            select: { title: true },
            where: { lessonId: lesson.id },
          });
          const titleList = titles.map((activity) => activity.title);
          expect(titleList).toContain(existingTitle);
          expect(titleList).toContain(importedTitle1);
          expect(titleList).toContain(importedTitle2);
        }).toPass({ timeout: 10_000 });
      } finally {
        fs.unlinkSync(importFile);
      }
    });

    test("imports activities in replace mode", async ({ authenticatedPage }) => {
      const { activities, chapter, course, lesson } = await createTestLesson(1);
      const existingTitle = activities[0]?.title ?? "";

      const prefix = randomUUID().slice(0, 8);
      const importedTitle1 = `Replaced ${prefix} 1`;
      const importedTitle2 = `Replaced ${prefix} 2`;

      const importFile = createImportFile([
        { kind: "background", title: importedTitle1 },
        { kind: "quiz", title: importedTitle2 },
      ]);

      try {
        await navigateToLessonPage(authenticatedPage, course.slug, chapter.slug, lesson.slug);

        await expect(authenticatedPage.getByRole("link", { name: existingTitle })).toBeVisible();

        await importFlow(authenticatedPage, importFile, "replace");

        await expectActivityNotVisible(authenticatedPage, existingTitle);

        await expect(authenticatedPage.getByRole("link", { name: importedTitle1 })).toBeVisible();

        await expect(authenticatedPage.getByRole("link", { name: importedTitle2 })).toBeVisible();

        await expect(async () => {
          const titles = await prisma.activity.findMany({
            select: { title: true },
            where: { lessonId: lesson.id },
          });
          const titleList = titles.map((activity) => activity.title);
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

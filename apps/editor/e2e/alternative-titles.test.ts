import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import tmp from "tmp";
import { type Page, expect, test } from "./fixtures";
import { importFlow } from "./helpers/import-dialog";

function createImportFile(slugs: string[]): string {
  const content = JSON.stringify({ alternativeTitles: slugs }, null, 2);
  const tmpFile = tmp.fileSync({ postfix: ".json", prefix: "alt-titles-" });
  fs.writeFileSync(tmpFile.name, content);
  return tmpFile.name;
}

async function createTestCourse() {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  return courseFixture({
    organizationId: org.id,
    slug: `e2e-alt-${randomUUID().slice(0, 8)}`,
  });
}

async function navigateToCoursePage(page: Page, slug: string) {
  await page.goto(`/ai/c/en/${slug}`);

  await expect(page.getByRole("textbox", { name: /edit course title/i })).toBeVisible();
}

async function openAlternativeTitles(page: Page) {
  await page.getByRole("button", { name: /alternative titles/i }).click();
}

async function createAlternativeTitleFixture(courseId: number, baseSlug: string) {
  const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
  await prisma.courseAlternativeTitle.create({
    data: { courseId, language: "en", slug },
  });
  return slug;
}

async function createManyAlternativeTitleFixtures(courseId: number, count: number) {
  const prefix = randomUUID().slice(0, 8);
  const slugs = Array.from(
    { length: count },
    (_, i) => `slug-${prefix}-${String(i + 1).padStart(2, "0")}`,
  );

  await prisma.courseAlternativeTitle.createMany({
    data: slugs.map((slug) => ({ courseId, language: "en", slug })),
  });

  return slugs;
}

test.describe("Alternative Titles Editor", () => {
  test("displays existing titles with count badge", async ({ authenticatedPage }) => {
    const course = await createTestCourse();

    const slug1 = await createAlternativeTitleFixture(course.id, "title-one");
    const slug2 = await createAlternativeTitleFixture(course.id, "title-two");

    await navigateToCoursePage(authenticatedPage, course.slug);

    const collapsibleButton = authenticatedPage.getByRole("button", {
      name: /alternative titles/i,
    });

    await expect(collapsibleButton).toBeVisible();
    await expect(authenticatedPage.getByText("(2)")).toBeVisible();

    await openAlternativeTitles(authenticatedPage);

    await expect(authenticatedPage.getByText(slug1)).toBeVisible();
    await expect(authenticatedPage.getByText(slug2)).toBeVisible();
  });

  test("adds a title and persists after reload", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    const uniqueId = randomUUID().slice(0, 8);
    const titleInput = `My New Title ${uniqueId}`;
    const expectedSlug = `my-new-title-${uniqueId}`;

    await navigateToCoursePage(authenticatedPage, course.slug);

    await openAlternativeTitles(authenticatedPage);

    await authenticatedPage.getByPlaceholder(/add alternative title/i).fill(titleInput);

    await authenticatedPage.getByRole("button", { name: /^add$/i }).click();

    await expect(authenticatedPage.getByText(expectedSlug)).toBeVisible();

    await authenticatedPage.reload();

    await expect(
      authenticatedPage.getByRole("textbox", { name: /edit course title/i }),
    ).toBeVisible();

    await openAlternativeTitles(authenticatedPage);

    await expect(authenticatedPage.getByText(expectedSlug)).toBeVisible();
  });

  test("removes a title and persists after reload", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    const slug = await createAlternativeTitleFixture(course.id, "to-remove");

    await navigateToCoursePage(authenticatedPage, course.slug);
    await openAlternativeTitles(authenticatedPage);

    await expect(authenticatedPage.getByText(slug)).toBeVisible();

    await authenticatedPage
      .getByRole("button", { name: new RegExp(`remove ${slug}`, "i") })
      .click();

    await expect(authenticatedPage.getByText(slug)).not.toBeVisible();

    await authenticatedPage.reload();

    await expect(
      authenticatedPage.getByRole("textbox", { name: /edit course title/i }),
    ).toBeVisible();

    await openAlternativeTitles(authenticatedPage);

    await expect(authenticatedPage.getByText(slug)).not.toBeVisible();
  });

  test("filters titles by search", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    const prefix = randomUUID().slice(0, 8);

    const machineSlug = await createAlternativeTitleFixture(course.id, `machine-${prefix}`);
    const deepSlug = await createAlternativeTitleFixture(course.id, `deep-${prefix}`);
    const dataSlug = await createAlternativeTitleFixture(course.id, `data-${prefix}`);

    await navigateToCoursePage(authenticatedPage, course.slug);
    await openAlternativeTitles(authenticatedPage);

    await expect(authenticatedPage.getByText(machineSlug)).toBeVisible();
    await expect(authenticatedPage.getByText(deepSlug)).toBeVisible();
    await expect(authenticatedPage.getByText(dataSlug)).toBeVisible();

    await authenticatedPage.getByPlaceholder(/search titles/i).fill(prefix);

    await expect(authenticatedPage.getByText(machineSlug)).toBeVisible();
    await expect(authenticatedPage.getByText(deepSlug)).toBeVisible();
    await expect(authenticatedPage.getByText(dataSlug)).toBeVisible();

    await authenticatedPage.getByPlaceholder(/search titles/i).fill("xyz");

    await expect(authenticatedPage.getByText(/no titles match your search/i)).toBeVisible();

    await authenticatedPage.getByPlaceholder(/search titles/i).clear();

    await expect(authenticatedPage.getByText(machineSlug)).toBeVisible();
    await expect(authenticatedPage.getByText(deepSlug)).toBeVisible();
    await expect(authenticatedPage.getByText(dataSlug)).toBeVisible();
  });

  test("shows more/less when there are many titles", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    const slugs = await createManyAlternativeTitleFixtures(course.id, 12);

    await navigateToCoursePage(authenticatedPage, course.slug);
    await openAlternativeTitles(authenticatedPage);

    await Promise.all(
      slugs.slice(0, 10).map((slug) => expect(authenticatedPage.getByText(slug)).toBeVisible()),
    );

    const slug11 = slugs[10];
    const slug12 = slugs[11];

    if (!slug11 || !slug12) {
      throw new Error("Expected at least 12 slugs");
    }

    await expect(authenticatedPage.getByText(slug11)).not.toBeVisible();
    await expect(authenticatedPage.getByText(slug12)).not.toBeVisible();

    await expect(authenticatedPage.getByText(/and 2 more/i)).toBeVisible();

    await authenticatedPage.getByText(/and 2 more/i).click();

    await expect(authenticatedPage.getByText(slug11)).toBeVisible();
    await expect(authenticatedPage.getByText(slug12)).toBeVisible();

    await expect(authenticatedPage.getByText(/show less/i)).toBeVisible();

    await authenticatedPage.getByText(/show less/i).click();

    await expect(authenticatedPage.getByText(slug11)).not.toBeVisible();
    await expect(authenticatedPage.getByText(slug12)).not.toBeVisible();
  });

  test("imports titles in merge mode", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    const existingSlug = await createAlternativeTitleFixture(course.id, "existing");
    const prefix = randomUUID().slice(0, 8);
    const importedSlug1 = `imported-${prefix}-1`;
    const importedSlug2 = `imported-${prefix}-2`;
    const importFile = createImportFile([importedSlug1, importedSlug2]);

    try {
      await navigateToCoursePage(authenticatedPage, course.slug);
      await openAlternativeTitles(authenticatedPage);

      await expect(authenticatedPage.getByText(existingSlug)).toBeVisible();

      await importFlow(authenticatedPage, importFile, "merge");

      await expect(authenticatedPage.getByText(existingSlug)).toBeVisible();
      await expect(authenticatedPage.getByText(importedSlug1)).toBeVisible();
      await expect(authenticatedPage.getByText(importedSlug2)).toBeVisible();

      await authenticatedPage.reload();

      await expect(
        authenticatedPage.getByRole("textbox", { name: /edit course title/i }),
      ).toBeVisible();

      await openAlternativeTitles(authenticatedPage);

      await expect(authenticatedPage.getByText(existingSlug)).toBeVisible();
      await expect(authenticatedPage.getByText(importedSlug1)).toBeVisible();
      await expect(authenticatedPage.getByText(importedSlug2)).toBeVisible();
    } finally {
      fs.unlinkSync(importFile);
    }
  });

  test("imports titles in replace mode", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    const oldSlug = await createAlternativeTitleFixture(course.id, "old");
    const prefix = randomUUID().slice(0, 8);
    const importedSlug1 = `replaced-${prefix}-1`;
    const importedSlug2 = `replaced-${prefix}-2`;
    const importFile = createImportFile([importedSlug1, importedSlug2]);

    try {
      await navigateToCoursePage(authenticatedPage, course.slug);
      await openAlternativeTitles(authenticatedPage);

      await expect(authenticatedPage.getByText(oldSlug)).toBeVisible();

      await importFlow(authenticatedPage, importFile, "replace");

      await expect(authenticatedPage.getByText(oldSlug)).not.toBeVisible();
      await expect(authenticatedPage.getByText(importedSlug1)).toBeVisible();
      await expect(authenticatedPage.getByText(importedSlug2)).toBeVisible();

      await authenticatedPage.reload();

      await expect(
        authenticatedPage.getByRole("textbox", { name: /edit course title/i }),
      ).toBeVisible();

      await openAlternativeTitles(authenticatedPage);

      await expect(authenticatedPage.getByText(oldSlug)).not.toBeVisible();
      await expect(authenticatedPage.getByText(importedSlug1)).toBeVisible();
      await expect(authenticatedPage.getByText(importedSlug2)).toBeVisible();
    } finally {
      fs.unlinkSync(importFile);
    }
  });

  test("does not add duplicate titles", async ({ authenticatedPage }) => {
    const course = await createTestCourse();
    const uniqueId = randomUUID().slice(0, 8);
    const slug = `dup-test-${uniqueId}`;

    await prisma.courseAlternativeTitle.create({
      data: { courseId: course.id, language: "en", slug },
    });

    await navigateToCoursePage(authenticatedPage, course.slug);
    await openAlternativeTitles(authenticatedPage);

    await expect(authenticatedPage.getByText("(1)")).toBeVisible();

    await authenticatedPage.getByPlaceholder(/add alternative title/i).fill(`Dup Test ${uniqueId}`);

    await authenticatedPage.getByRole("button", { name: /^add$/i }).click();

    await expect(authenticatedPage.getByText("(1)")).toBeVisible();
  });

  test("does not submit empty input", async ({ authenticatedPage }) => {
    const course = await createTestCourse();

    await navigateToCoursePage(authenticatedPage, course.slug);
    await openAlternativeTitles(authenticatedPage);

    await authenticatedPage.getByRole("button", { name: /^add$/i }).click();

    await expect(
      authenticatedPage.getByRole("button", { name: /alternative titles/i }),
    ).not.toContainText("(");
  });
});

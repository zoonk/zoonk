import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "@zoonk/db";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { expect, type Page, test } from "./fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_IMAGES = {
  invalidTxt: path.join(__dirname, "fixtures/images/invalid.txt"),
  tooLarge: path.join(__dirname, "fixtures/images/too-large.png"),
  validJpg: path.join(__dirname, "fixtures/images/valid.jpg"),
  validPng: path.join(__dirname, "fixtures/images/valid.png"),
};

async function createTestCourse(imageUrl: string | null = null) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { slug: "ai" },
  });

  return courseFixture({
    imageUrl,
    isPublished: true,
    organizationId: org.id,
    slug: `e2e-img-${randomUUID().slice(0, 8)}`,
  });
}

async function navigateToCoursePage(page: Page, slug: string) {
  await page.goto(`/ai/c/en/${slug}`);

  await expect(
    page.getByRole("textbox", { name: /edit course title/i }),
  ).toBeVisible();
}

function getUploadButton(page: Page) {
  return page.getByRole("button", { name: /upload course image/i });
}

function getChangeButton(page: Page) {
  return page.getByRole("button", { name: /change course image/i });
}

function getRemoveButton(page: Page) {
  return page.getByRole("button", { name: /remove image/i });
}

async function expectErrorToast(page: Page, message: RegExp) {
  await expect(page.getByText(message)).toBeVisible();
}

test.describe("Course Image - Upload", () => {
  test("uploads image and persists after reload", async ({
    authenticatedPage,
  }) => {
    const course = await createTestCourse(null);
    await navigateToCoursePage(authenticatedPage, course.slug);

    // Verify no image state (upload button visible)
    await expect(getUploadButton(authenticatedPage)).toBeVisible();

    const [fileChooser] = await Promise.all([
      authenticatedPage.waitForEvent("filechooser"),
      getUploadButton(authenticatedPage).click(),
    ]);

    await fileChooser.setFiles(TEST_IMAGES.validPng);

    // Wait for state change (change button indicates image was uploaded)
    await expect(getChangeButton(authenticatedPage)).toBeVisible();

    // Verify persistence
    await authenticatedPage.reload();
    await expect(getChangeButton(authenticatedPage)).toBeVisible();
  });
});

test.describe("Course Image - Replace", () => {
  test("replaces existing image with new one", async ({
    authenticatedPage,
  }) => {
    const course = await createTestCourse("https://example.com/old-image.jpg");
    await navigateToCoursePage(authenticatedPage, course.slug);

    // Verify we start with "Change" button and get current image src
    const changeButton = getChangeButton(authenticatedPage);
    await expect(changeButton).toBeVisible();

    // Get the img inside the button (decorative image with alt="")
    const courseImg = changeButton.locator("img");
    await expect(courseImg).toBeVisible();
    const originalSrc = await courseImg.getAttribute("src");

    const [fileChooser] = await Promise.all([
      authenticatedPage.waitForEvent("filechooser"),
      changeButton.click(),
    ]);

    await fileChooser.setFiles(TEST_IMAGES.validJpg);

    // Verify image src changed after upload
    await expect(async () => {
      const newSrc = await courseImg.getAttribute("src");
      expect(newSrc).not.toBe(originalSrc);
    }).toPass();

    // Verify new image persists after reload
    await authenticatedPage.reload();
    const reloadedSrc = await changeButton.locator("img").getAttribute("src");
    expect(reloadedSrc).not.toBe(originalSrc);
  });
});

test.describe("Course Image - Remove", () => {
  test("removes image when clicking remove button", async ({
    authenticatedPage,
  }) => {
    const course = await createTestCourse("https://example.com/test-image.jpg");
    await navigateToCoursePage(authenticatedPage, course.slug);

    // Verify image state
    await expect(getChangeButton(authenticatedPage)).toBeVisible();

    // Hover to reveal remove button and click
    await getChangeButton(authenticatedPage).hover();
    await getRemoveButton(authenticatedPage).click();

    // Verify back to no-image state
    await expect(getUploadButton(authenticatedPage)).toBeVisible();
  });

  test("removes image with keyboard", async ({ authenticatedPage }) => {
    const course = await createTestCourse("https://example.com/test-image.jpg");
    await navigateToCoursePage(authenticatedPage, course.slug);

    await expect(getChangeButton(authenticatedPage)).toBeVisible();

    await getChangeButton(authenticatedPage).focus();
    await authenticatedPage.keyboard.press("Delete");

    await expect(getUploadButton(authenticatedPage)).toBeVisible();
  });
});

test.describe("Course Image - Validation", () => {
  test("shows error for file too large", async ({ authenticatedPage }) => {
    const course = await createTestCourse(null);
    await navigateToCoursePage(authenticatedPage, course.slug);

    const [fileChooser] = await Promise.all([
      authenticatedPage.waitForEvent("filechooser"),
      getUploadButton(authenticatedPage).click(),
    ]);

    await fileChooser.setFiles(TEST_IMAGES.tooLarge);

    await expectErrorToast(authenticatedPage, /file is too large/i);
    // Verify still in upload state (no change)
    await expect(getUploadButton(authenticatedPage)).toBeVisible();
  });

  test("shows error for invalid file type", async ({ authenticatedPage }) => {
    const course = await createTestCourse(null);
    await navigateToCoursePage(authenticatedPage, course.slug);

    const [fileChooser] = await Promise.all([
      authenticatedPage.waitForEvent("filechooser"),
      getUploadButton(authenticatedPage).click(),
    ]);

    await fileChooser.setFiles(TEST_IMAGES.invalidTxt);

    await expectErrorToast(authenticatedPage, /invalid file type/i);
    await expect(getUploadButton(authenticatedPage)).toBeVisible();
  });
});

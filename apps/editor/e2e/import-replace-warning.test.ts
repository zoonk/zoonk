import { getAiOrganization } from "@zoonk/e2e/helpers";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { AI_ORG_SLUG } from "@zoonk/utils/constants";
import { type Page, expect, test } from "./fixtures";
import { openMoreOptionsMenu } from "./helpers/import-dialog";

async function createTestCourse() {
  const org = await getAiOrganization();

  return courseFixture({ organizationId: org.id });
}

async function openImportDialog(page: Page) {
  await openMoreOptionsMenu(page);
  await page.getByRole("menuitem", { name: /import/i }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  return dialog;
}

const WARNING_TEXT = /permanently delete all existing items/i;

test.describe("Import Replace Warning", () => {
  test("does not show warning when dialog opens (merge is default)", async ({
    authenticatedPage,
  }) => {
    const course = await createTestCourse();
    await authenticatedPage.goto(`/${AI_ORG_SLUG}/c/${course.slug}`);
    await expect(
      authenticatedPage.getByRole("textbox", { name: /edit course title/i }),
    ).toBeVisible();

    const dialog = await openImportDialog(authenticatedPage);

    await expect(dialog.getByLabel(/merge/i)).toBeChecked();
    await expect(dialog.getByRole("alert")).not.toBeVisible();
    await expect(dialog.getByRole("button", { name: /^import$/i })).toBeVisible();
  });

  test("shows warning and destructive button when Replace is selected", async ({
    authenticatedPage,
  }) => {
    const course = await createTestCourse();
    await authenticatedPage.goto(`/${AI_ORG_SLUG}/c/${course.slug}`);
    await expect(
      authenticatedPage.getByRole("textbox", { name: /edit course title/i }),
    ).toBeVisible();

    const dialog = await openImportDialog(authenticatedPage);

    await dialog.getByText(/replace \(remove existing first\)/i).click();

    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByText(WARNING_TEXT)).toBeVisible();
    await expect(dialog.getByRole("button", { name: /replace all/i })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /^import$/i })).not.toBeVisible();
  });

  test("hides warning and reverts button when switching back to Merge", async ({
    authenticatedPage,
  }) => {
    const course = await createTestCourse();
    await authenticatedPage.goto(`/${AI_ORG_SLUG}/c/${course.slug}`);
    await expect(
      authenticatedPage.getByRole("textbox", { name: /edit course title/i }),
    ).toBeVisible();

    const dialog = await openImportDialog(authenticatedPage);

    // Select Replace
    await dialog.getByText(/replace \(remove existing first\)/i).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(dialog.getByRole("button", { name: /replace all/i })).toBeVisible();

    // Switch back to Merge
    await dialog.getByText(/merge \(add to existing\)/i).click();
    await expect(dialog.getByRole("alert")).not.toBeVisible();
    await expect(dialog.getByRole("button", { name: /^import$/i })).toBeVisible();
    await expect(dialog.getByRole("button", { name: /replace all/i })).not.toBeVisible();
  });
});

import { type Page, expect } from "@playwright/test";

/**
 * Opens the lesson type menu without racing initial page hydration. Next.js
 * can render the trigger before its client event handler is attached, so the
 * click is retried only while the semantic menu label is still absent.
 */
export async function openLessonTypeFilterMenu({ page }: { page: Page }) {
  const filterButton = page.getByRole("button", { name: /filter lesson types/iu });
  const menuLabel = page.getByText(/show lesson types/iu);

  await expect(filterButton).toBeVisible();
  await expect(filterButton).toBeEnabled();

  await expect(async () => {
    if (!(await menuLabel.isVisible())) {
      await filterButton.click();
    }

    await expect(menuLabel).toBeVisible({ timeout: 1000 });
  }).toPass();

  return filterButton;
}

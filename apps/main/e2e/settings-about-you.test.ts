import { expectHydrated } from "@zoonk/e2e/hydration";
import { expect, test } from "./fixtures";

test("Save follows the selection on an unanswered About you question", async ({
  userWithoutProgress: page,
}) => {
  await page.goto("/settings/about-you/watch");

  const anime = page.getByRole("button", { exact: true, name: "Anime" });
  const save = page.getByRole("button", { exact: true, name: "Save" });
  await expectHydrated(anime);
  await expect(save).toBeDisabled();

  await anime.click();
  await expect(save).toBeEnabled();

  await anime.click();
  await expect(save).toBeDisabled();
});

test("an About you question opens beside the list on a wide screen and takes the page on a narrow one", async ({
  userWithoutProgress: page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.goto("/settings/about-you");

  const title = page.locator('[data-slot="section-title"]');
  const row = page.getByRole("link", { name: /^What you watch/u });
  const detail = page.locator('[data-slot="settings-detail"]');
  const save = detail.getByRole("button", { exact: true, name: "Save" });
  await expectHydrated(row);
  const titleTop = await title.evaluate((element) => element.getBoundingClientRect().top);

  await row.click();
  await expect(save).toBeVisible();
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute("aria-current", "page");
  expect(await title.evaluate((element) => element.getBoundingClientRect().top)).toBe(titleTop);

  const [listEnd, detailStart] = await Promise.all([
    row.evaluate((element) => element.getBoundingClientRect().right),
    detail.evaluate((element) => element.getBoundingClientRect().left),
  ]);

  expect(listEnd).toBeLessThan(detailStart);

  await page.setViewportSize({ height: 900, width: 820 });
  await expect(save).toBeVisible();
  await expect(row).toBeHidden();
});

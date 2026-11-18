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

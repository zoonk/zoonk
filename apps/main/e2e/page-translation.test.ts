import { expectHydrated } from "@zoonk/e2e/hydration";
import { translatePage } from "@zoonk/e2e/page-translation";
import { expect, test } from "./fixtures";

test("a page the browser translates keeps working when React replaces the translated text", async ({
  userWithoutProgress: page,
}) => {
  await page.goto("/profile");
  await expectHydrated(page.getByRole("textbox", { exact: true, name: "Name" }));
  await translatePage(page);

  // The name's hint is bare text, which React removes itself when the error takes its place.
  await page.getByRole("textbox", { exact: true, name: "[Name]" }).fill("a".repeat(151));
  await expect(page.getByText("[Use ][150][ characters or fewer.]")).toBeVisible();
  await expect(page.getByText(/How Zoonk and your buddy call you/u)).toBeHidden();
});

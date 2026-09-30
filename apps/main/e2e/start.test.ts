import { expect, test } from "./fixtures";

test.describe("Old start pages", () => {
  test("a course prompt URL opens onboarding with the goal filled in", async ({ page }) => {
    await page.goto(`/start/learn/${encodeURIComponent("Python 3.12")}`);

    await expect(page).toHaveURL(/\/start\?goal=Python(?:%20|\+)3\.12$/u);
    await expect(page.getByRole("textbox", { name: "Your goal" })).toHaveValue("Python 3.12");
  });

  test("keeps the language of a localized course prompt URL", async ({ page }) => {
    await page.goto("/pt/start/learn/Fotografia");

    await expect(page).toHaveURL(/\/pt\/start\?goal=Fotografia$/u);
    await expect(page.locator("html")).toHaveAttribute("lang", "pt");
  });

  test.describe("the other old start pages open onboarding", () => {
    for (const path of ["/start/learn", "/start/speak", "/start/speak/jv", "/start/exam"]) {
      test(path, async ({ page }) => {
        await page.goto(path);

        await expect(page).toHaveURL(/\/start$/u);
        await expect(page.getByRole("textbox", { name: "Your goal" })).toHaveValue("");
      });
    }
  });
});

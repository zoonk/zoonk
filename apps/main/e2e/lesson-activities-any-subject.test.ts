import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import {
  checkActivity,
  expectVerdict,
  openActivity,
  pressOnSlider,
  valueInput,
} from "./activity-lesson";
import { expect, test } from "./fixtures";
import { MODES } from "./learn-personas";

for (const mode of MODES) {
  test.describe(`any-subject activities in ${mode} mode`, () => {
    test("predict then reveal: a close guess shows the real value", async ({ page }) => {
      await openActivity(page, { mode, template: "predictReveal" });
      await expect(page.getByText("Drag to guess")).toBeVisible();
      await valueInput(page).fill("14");
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("Real value: 14 times")).toBeVisible();
      await expect(page.getByText("The map stretches land near the poles.")).toBeVisible();
    });

    test("predict then reveal: a far guess says how far", async ({ page }) => {
      await openActivity(page, { mode, template: "predictReveal" });
      await valueInput(page).fill("3");
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("Your guess is about 4.7 times too small.")).toBeVisible();
    });

    test("before and after: the change is computed once checked", async ({ page }) => {
      await openActivity(page, { mode, template: "beforeAfter" });
      await expect(page.getByRole("region", { name: "1914" })).toBeHidden();
      await page.getByRole("button", { name: "Show after: 1914" }).click();

      await expect(
        page.getByRole("region", { name: "1914" }).getByText("1.5", { exact: true }),
      ).toBeVisible();

      await valueInput(page).fill("0.12");
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("8.3 times less")).toBeVisible();
    });

    test("before and after: a wrong ratio is marked", async ({ page }) => {
      await openActivity(page, { mode, template: "beforeAfter" });
      await valueInput(page).fill("8");
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByRole("region", { name: "1914" })).toBeVisible();
    });
  });
}

test("activities render lesson math in the prompt and the reveal", async ({ page }) => {
  const fixture = activityContentFixtures.predictReveal;

  await openActivity(page, {
    content: {
      ...fixture,
      fields: { ...fixture.fields, explanation: "Africa is about $14 \\times$ Greenland." },
      prompt: "How many Greenlands fit in $A_{Africa}$?",
    },
    mode: "focus",
    template: "predictReveal",
  });

  const prompt = page.getByRole("heading", { name: /How many Greenlands fit in/u });

  await expect(prompt.getByRole("math")).toBeVisible();
  await expect(prompt).not.toContainText("$");

  await valueInput(page).fill("14");
  await checkActivity(page);
  await expect(page.getByRole("figure").getByRole("math")).toBeVisible();
});

test.describe("any-subject activities with a keyboard", () => {
  test("predict then reveal: arrow keys place the guess", async ({ page }) => {
    await openActivity(page, { mode: "focus", template: "predictReveal" });
    await pressOnSlider(page, "Your guess", "ArrowRight", 10);
    await expect(page.getByText(/^Your guess: /u)).toBeVisible();
    await expect(valueInput(page)).not.toHaveValue("");
  });

  test("before and after: showing the after state moves focus to it", async ({ page }) => {
    await openActivity(page, { mode: "focus", template: "beforeAfter" });
    await page.getByRole("button", { name: "Show after: 1914" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: "1914" })).toBeFocused();
  });
});

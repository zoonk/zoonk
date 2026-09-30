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
  test.describe(`lesson activities in ${mode} mode`, () => {
    test("slider graph: moving the rate produces the value to check", async ({ page }) => {
      await openActivity(page, { mode, template: "sliderGraph" });
      await pressOnSlider(page, "Rate per year", "ArrowRight", 4);

      await expect(valueInput(page)).toHaveValue("3869.68");

      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("number line: dragging the dot answers where the change lands", async ({ page }) => {
      await openActivity(page, { mode, template: "numberLine" });
      await pressOnSlider(page, "Your answer on the number line", "ArrowRight", 8);
      await expect(valueInput(page)).toHaveValue("5");
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText(/3 \+ 3 \+ 5 = 5/u)).toBeVisible();
    });

    test("area model: moving a split keeps the same total", async ({ page }) => {
      await openActivity(page, { mode, template: "areaModel" });
      await expect(page.getByText(/200 \+ 30 \+ 80 \+ 12 = 322/u)).toBeVisible();
      await pressOnSlider(page, "Split across the width", "ArrowLeft", 3);
      await expect(page.getByText(/170 \+ 60 \+ 68 \+ 24 = 322/u)).toBeVisible();
      await page.getByRole("radio", { name: /322 m²/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("balance: one-sided moves tip the scale and equal moves solve it", async ({ page }) => {
      await openActivity(page, { mode, template: "balance" });

      const takeLeftBag = page.getByRole("button", {
        name: "Take off the left side: One bag of rice",
      });

      const takeRightBag = page.getByRole("button", {
        name: "Take off the right side: One bag of rice",
      });

      await takeLeftBag.click();
      await expect(page.getByText("Take the same off both sides.")).toBeVisible();
      await page.getByRole("button", { name: "Undo" }).click();
      await expect(page.getByText("Take the same off both sides.")).toBeHidden();

      await takeLeftBag.click();
      await takeRightBag.click();
      await takeLeftBag.click();
      await takeRightBag.click();
      await page.getByRole("button", { name: "Take off the left side: 1 kg" }).click();
      await page.getByRole("button", { name: "Take off the right side: 1 kg" }).click();
      await page.getByRole("button", { name: "Split both sides into 2 equal groups" }).click();

      await expect(valueInput(page)).toHaveValue("3");
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("step solver: a wrong move explains itself and counts as wrong", async ({ page }) => {
      await openActivity(page, { mode, template: "stepSolver" });
      await page.getByRole("button", { name: "Add the tax" }).click();
      await expect(page.getByText("The discount comes first.")).toBeVisible();
      await page.getByRole("button", { name: "Take 25% off" }).click();
      await page.getByRole("button", { name: "$45" }).click();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("Your first pick: Add the tax")).toBeVisible();
    });

    test("estimate then reveal: the real value shows next to the guess", async ({ page }) => {
      await openActivity(page, { mode, template: "estimateReveal" });
      await expect(page.getByText("Drag to guess")).toBeVisible();
      await pressOnSlider(page, "Your guess", "ArrowRight", 20);
      await expect(page.getByText(/Your guess: /u)).toBeVisible();
      await valueInput(page).fill("11.57");
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("A billion seconds is about 32 years.")).toBeVisible();
    });

    test("predict then simulate: the runs start after the guess is checked", async ({ page }) => {
      await openActivity(page, { mode, template: "predictSimulate" });

      await expect(
        page.getByText("Pick your guess, then check it to run the simulation."),
      ).toBeVisible();

      await page.getByRole("radio", { name: /About 1 in 4/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText(/The exact chance is 25%/u)).toBeVisible();
      await page.getByRole("button", { name: "Run again" }).click();
      await expect(page.getByText(/The exact chance is 25%/u)).toBeVisible();
    });

    test("chart reader: tapping a span measures it", async ({ page }) => {
      await openActivity(page, { mode, template: "chartReader" });
      await page.getByRole("button", { name: "2010 to 2020" }).click();

      await expect(page.getByRole("button", { name: "2010 to 2020" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      await page.getByRole("radio", { name: /24 ppm/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });
  });
}

import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import {
  checkActivity,
  expectVerdict,
  openActivity,
  pressOnSlider,
  valueInput,
} from "../_test-utils/activity-player";

describe("lesson activities", () => {
  it("formula model: moving the rate produces the value to check", async () => {
    openActivity({ template: "formulaModel" });
    await pressOnSlider("Rate per year", "ArrowRight", 4);

    await expect.element(valueInput()).toHaveValue("3869.68");

    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("number line: dragging the dot answers where the change lands", async () => {
    openActivity({ template: "numberLine" });
    await pressOnSlider("Your answer on the number line", "ArrowRight", 8);
    await expect.element(valueInput()).toHaveValue("5");
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText(/3 \+ 3 \+ 5 = 5/u)).toBeVisible();
  });

  it("area model: moving a split keeps the same total", async () => {
    openActivity({ template: "areaModel" });
    await expect.element(page.getByText(/200 \+ 30 \+ 80 \+ 12 = 322/u)).toBeVisible();
    await pressOnSlider("Split across the width", "ArrowLeft", 3);
    await expect.element(page.getByText(/170 \+ 60 \+ 68 \+ 24 = 322/u)).toBeVisible();
    await page.getByRole("radio", { name: /322 m²/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("balance: one-sided moves tip the scale and equal moves solve it", async () => {
    openActivity({ template: "balance" });

    const takeLeftBag = page.getByRole("button", {
      name: "Take off the left side: One bag of rice",
    });

    const takeRightBag = page.getByRole("button", {
      name: "Take off the right side: One bag of rice",
    });

    await takeLeftBag.click();
    await expect.element(page.getByText("Take the same off both sides.")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.element(page.getByText("Take the same off both sides.")).not.toBeInTheDocument();

    await takeLeftBag.click();
    await takeRightBag.click();
    await takeLeftBag.click();
    await takeRightBag.click();
    await page.getByRole("button", { name: "Take off the left side: 1 kg" }).click();
    await page.getByRole("button", { name: "Take off the right side: 1 kg" }).click();
    await page.getByRole("button", { name: "Split both sides into 2 equal groups" }).click();

    await expect.element(valueInput()).toHaveValue("3");
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("step solver: a wrong move explains itself and counts as wrong", async () => {
    openActivity({ template: "stepSolver" });
    await page.getByRole("button", { name: "Add the tax" }).click();
    await expect.element(page.getByText("The discount comes first.")).toBeVisible();
    await page.getByRole("button", { name: "Take 25% off" }).click();
    await page.getByRole("button", { name: "$45" }).click();
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("Your first pick: Add the tax")).toBeVisible();
  });

  it("guess then reveal: the computed value shows next to the guess, with its workings", async () => {
    openActivity({ template: "guessReveal" });
    await expect.element(page.getByText("Drag to guess")).toBeVisible();
    await pressOnSlider("Your guess", "ArrowRight", 20);
    await expect.element(page.getByText(/Your guess: /u)).toBeVisible();
    await valueInput().fill("11.57");
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("A billion seconds is about 32 years.")).toBeVisible();
    await expect.element(page.getByText("minutes", { exact: true })).toBeVisible();
  });

  it("random simulation by chance: the runs start after the guess is checked", async () => {
    openActivity({ template: "randomSimulation" });

    await expect
      .element(page.getByText("Pick your guess, then check it to run the simulation."))
      .toBeVisible();

    await page.getByRole("radio", { name: /About 1 in 4/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText(/The exact chance is 25%/u)).toBeVisible();
    await page.getByRole("button", { name: "Run again" }).click();
    await expect.element(page.getByText(/The exact chance is 25%/u)).toBeVisible();
  });

  it("random simulation with one trial a run: its two bars say whether they're the hit", async () => {
    const { randomSimulation } = activityContentFixtures;

    openActivity({
      content: {
        ...randomSimulation,
        fields: {
          ...randomSimulation.fields,
          hitLabel: "Win the prize",
          model: {
            hit: { comparison: "exactly", value: 1 },
            kind: "binomial",
            probability: 0.25,
            trials: 1,
          },
          trialLabel: "draws",
        },
      },
      template: "randomSimulation",
    });

    await page.getByRole("radio", { name: /About 1 in 4/u }).click();
    await checkActivity();

    // A 0 and a 1 would say nothing: the bars read "No" and "Yes" under the chart's "Win the prize".
    await expect.element(page.getByText("No", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Yes", { exact: true })).toBeVisible();
    await expect.element(page.getByText("0", { exact: true })).not.toBeInTheDocument();
  });

  it("a money answer's unit sits where the language writes it, before the field", async () => {
    const { balance } = activityContentFixtures;

    openActivity({
      content: { ...balance, check: { ...balance.check, unit: "$" } },
      template: "balance",
    });

    const field = valueInput();
    const unit = page.getByText("$", { exact: true });
    await expect.element(unit).toBeVisible();

    // Before the field for screen readers, as the feedback writes "$3" after Check.
    expect(unit.element().compareDocumentPosition(field.element())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    await field.fill("3");
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("$3", { exact: true })).toBeVisible();
  });

  it("shows the close wrong number separately from the expected answer", async () => {
    const { numberLine } = activityContentFixtures;

    openActivity({
      content: {
        ...numberLine,
        check: {
          ...numberLine.check,
          answer: 0.125,
          tolerance: { kind: "absolute", value: 0.0001 },
          unit: undefined,
        },
      },
      template: "numberLine",
    });

    await valueInput().fill("0.1254");
    await checkActivity();
    await expectVerdict("Not quite");
    const feedback = page.getByRole("region", { name: "Answer feedback" });
    await expect.element(feedback.getByText("0.1254", { exact: true })).toBeVisible();
    await expect.element(feedback.getByText("0.125", { exact: true })).toBeVisible();
  });

  it("chart reader: tapping a span measures it", async () => {
    openActivity({ template: "chartReader" });
    await page.getByRole("button", { name: "2010 to 2020" }).click();

    await expect
      .element(page.getByRole("button", { name: "2010 to 2020" }))
      .toHaveAttribute("aria-pressed", "true");

    await page.getByRole("radio", { name: /24 ppm/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");
  });
});

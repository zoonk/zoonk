import { numericCheck } from "@zoonk/testing/fixtures/activity-checks";
import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";
import {
  checkActivity,
  expectVerdict,
  guessOnScale,
  openActivity,
  pressOnSlider,
  valueInput,
} from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { explanationStep } from "../preview/preview-steps";

function expectCenteredChipMark(chip: Element) {
  const marker = chip.querySelector('[data-slot="line-marker"]')!;
  const icon = marker.getBoundingClientRect();
  const label = marker.nextElementSibling!.getBoundingClientRect();

  expect(label.height).toBeGreaterThan(icon.height);
  expect(icon.top + icon.height / 2).toBeCloseTo(label.top + label.height / 2, 0);
}

describe("lesson activities", () => {
  it("formula model: moving the rate produces the value to check", async () => {
    openActivity({ template: "formulaModel" });
    await pressOnSlider("Rate per year", "ArrowRight", 4);

    await expect.element(valueInput()).toHaveValue("3,869.68");

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

  it("area model: the total a choice asks for waits for the check", async () => {
    openActivity({ template: "areaModel" });
    await expect.element(page.getByText(/200 \+ 30 \+ 80 \+ 12 = \?/u)).toBeVisible();
    await pressOnSlider("Split across the width", "ArrowLeft", 3);
    await expect.element(page.getByText(/170 \+ 60 \+ 68 \+ 24 = \?/u)).toBeVisible();
    await page.getByRole("radio", { name: /322 m²/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText(/170 \+ 60 \+ 68 \+ 24 = 322/u)).toBeVisible();
  });

  it("area model: an explanation that explores it shows the total", async () => {
    const { fields } = activityContentFixtures.areaModel;
    const step = explanationStep({ explore: { fields, template: "areaModel" }, text: "Split it." });

    renderLessonPlayer({ lesson: buildLesson([step]) });

    await expect.element(page.getByText(/200 \+ 30 \+ 80 \+ 12 = 322/u)).toBeVisible();
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

  it("step solver: the mark centers on a wrapped wrong choice", async () => {
    await atViewport({ height: 844, width: 390 }, async () => {
      const solver = activityContentFixtures.stepSolver;
      const [first, ...rest] = solver.fields.steps;
      const text = "Add the sales tax to the original price before taking the discount";

      const choices = first!.choices.map((choice) =>
        choice.isCorrect ? choice : { ...choice, text },
      );

      openActivity({
        content: {
          ...solver,
          fields: { ...solver.fields, steps: [{ ...first!, choices }, ...rest] },
        },
        template: "stepSolver",
      });

      const wrong = page.getByRole("button", { name: text });
      await wrong.click();
      await expect.element(wrong).toBeDisabled();
      expectCenteredChipMark(wrong.element());
    });
  });

  it("money ticks in millions shorten without giving adjacent ticks the same number", async () => {
    const content = engineModeFixtures.guessReveal.moneyMillions;
    openActivity({ content, template: "guessReveal" });
    await expect.element(page.getByText("R$1.5M", { exact: true })).toBeVisible();
    await expect.element(page.getByText("R$2M", { exact: true })).toBeVisible();
  });

  it.each([
    { ticks: ["R$0", "R$1M", "R$2M"], width: 320 },
    { ticks: ["R$0", "R$2M"], width: 288 },
  ])(
    "money guesses at $width pixels and 200 percent use fitting round ticks without overlaps",
    async ({ width, ticks }) => {
      document.documentElement.style.fontSize = "200%";

      onTestFinished(() => {
        document.documentElement.style.removeProperty("font-size");
      });

      await atViewport({ height: 1000, width }, async () => {
        openActivity({
          content: engineModeFixtures.guessReveal.moneyMillions,
          template: "guessReveal",
        });

        await expect.element(page.getByRole("slider")).toBeVisible();

        await expect
          .poll(() =>
            [...document.querySelectorAll('[data-slot="guess-ticks"] span')].map(
              (node) => node.textContent,
            ),
          )
          .toStrictEqual(ticks);

        const nodes = [...document.querySelectorAll('[data-slot="guess-ticks"] span')];
        const bounds = nodes.map((node) => node.getBoundingClientRect());

        for (let index = 1; index < bounds.length; index += 1) {
          expect(bounds[index]!.left).toBeGreaterThanOrEqual(bounds[index - 1]!.right + 4);
        }
      });
    },
  );

  it("money guess retains currency in readouts, ticks, the difference and the accessible scale", async () => {
    const content = engineModeFixtures.guessReveal.money;
    openActivity({ content, template: "guessReveal" });
    await guessOnScale(content.fields, 900);
    await checkActivity();
    await expect.element(page.getByText(/Real value: R\$1,200/u)).toBeVisible();
    await expect.element(page.getByText(/Your guess is off by R\$300/u)).toBeVisible();
    await expect.element(page.getByText("R$0", { exact: true })).toBeVisible();
    await expect.element(page.getByText("R$2,000", { exact: true })).toBeVisible();

    expect(
      document.querySelector('[data-slot="activity-text-alternative"]')?.textContent,
    ).toContain("R$1,200");

    await expect
      .element(page.getByRole("slider", { name: "Your guess" }))
      .toHaveAttribute("aria-valuetext", "R$900");
  });

  it("guess readouts do not attach a free-text plural unit to one", async () => {
    const source = activityContentFixtures.guessReveal;

    openActivity({
      content: { ...source, fields: { ...source.fields, unit: "days" } },
      template: "guessReveal",
    });

    await guessOnScale(source.fields, 1);
    await expect.element(page.getByText("Your guess: 1", { exact: true })).toBeVisible();
    await expect.element(page.getByText("in days", { exact: true })).toBeVisible();

    await expect
      .element(page.getByRole("slider", { name: "Your guess" }))
      .toHaveAttribute("aria-valuetext", "1. in days");
  });

  it("guess then reveal: the computed value shows next to the guess, with its workings", async () => {
    openActivity({ template: "guessReveal" });
    await expect.element(page.getByText("Drag to guess")).toBeVisible();
    await pressOnSlider("Your guess", "ArrowRight", 20);
    await expect.element(page.getByText(/Your guess: /u)).toBeVisible();
    await guessOnScale(activityContentFixtures.guessReveal.fields, 11.57);
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

    await page.getByRole("radio", { name: /About 25% of the time/u }).click();

    const hitLabel = page.getByText(activityContentFixtures.randomSimulation.fields.hitLabel, {
      exact: true,
    });

    const label = hitLabel.element();
    const card = label.closest("figure")!;
    const top = label.getBoundingClientRect().top - card.getBoundingClientRect().top;
    await checkActivity();
    await expectVerdict("Correct!");

    expect(label.getBoundingClientRect().top - card.getBoundingClientRect().top).toBeCloseTo(
      top,
      0,
    );

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

    await page.getByRole("radio", { name: /About 25% of the time/u }).click();
    await checkActivity();

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

    expect(unit.element().compareDocumentPosition(field.element())).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    await field.fill("3");
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(field).toHaveValue("3");
  });

  it("keeps the typed near miss distinct from the right answer", async () => {
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
    await expect.element(valueInput()).toHaveValue("0.1254");
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

  it("chart reader: the check mark centers on a wrapped span", async () => {
    await atViewport({ height: 844, width: 390 }, async () => {
      const chart = activityContentFixtures.chartReader;
      const text = "From the 2010 measurement to the 2020 measurement";

      const spans = chart.fields.spans.map((span) =>
        span.id === "late" ? { ...span, label: text } : span,
      );

      openActivity({
        content: {
          ...chart,
          check: numericCheck(24, { output: "late" }),
          fields: { ...chart.fields, spans },
        },
        template: "chartReader",
      });

      const span = page.getByRole("button", { name: text });
      await span.click();
      await checkActivity();
      await expectVerdict("Correct!");
      expectCenteredChipMark(span.element());
    });
  });

  it("chart reader: an axis label alone does not turn numbers into clock times", async () => {
    const chart = activityContentFixtures.chartReader;

    openActivity({
      content: {
        ...chart,
        fields: {
          ...chart.fields,
          points: [
            { x: 10, y: 390 },
            { x: 12.5, y: 400 },
            { x: 15, y: 414 },
          ],
          spans: [{ from: 10, id: "late", label: "The trading window", to: 15 }],
          xLabel: "Hour of the day",
        },
      },
      template: "chartReader",
    });

    await expect.element(page.getByText("Hour of the day", { exact: true })).toBeVisible();
    const labels = [...document.querySelectorAll('[data-slot="plot-axis-x"] text')];
    expect(labels.map((label) => label.textContent)).toContain("10");
  });
});

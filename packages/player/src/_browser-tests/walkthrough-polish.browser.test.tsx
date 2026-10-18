import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
  checkActivity,
  expectVerdict,
  openActivity,
  press,
  pressOnSlider,
  valueInput,
} from "../_test-utils/activity-player";
import {
  acceptedAnswerCheck,
  buildAdapters,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";
import type * as NextIntl from "next-intl";

const language = vi.hoisted(() => ({ current: "en" }));

/** The existing message shim supplies English; this case supplies Portuguese unit words too. */
vi.mock("next-intl", async (importOriginal) => {
  const original = await importOriginal<typeof NextIntl>();

  return {
    ...original,
    useExtracted: () => {
      const translate = original.useExtracted();

      const message = (source: string, values?: Record<string, number | string>) => {
        const localized =
          language.current === "pt"
            ? source
                .replaceAll(/\bseconds\b/gu, "segundos")
                .replaceAll(/\bsecond\b/gu, "segundo")
                .replaceAll(/\batoms\b/gu, "átomos")
                .replaceAll(/\batom\b/gu, "átomo")
            : source;

        return translate(localized, values);
      };

      return Object.assign(message, { rich: translate.rich });
    },
    useLocale: () => language.current,
  };
});

const estimate = {
  ...activityContentFixtures.guessReveal,
  check: {
    ...activityContentFixtures.guessReveal.check,
    answer: 700_000,
    tolerance: { kind: "relative", value: 0.05 },
    unit: "atoms",
  },
  fields: {
    ...activityContentFixtures.guessReveal.fields,
    max: 1_000_000_000,
    min: 1,
    truth: {
      expression: "700000",
      kind: "computed",
      workings: [{ expression: "700000", label: "Atoms across" }],
    },
    unit: "atoms",
  },
} as const;

const detector = {
  ...activityContentFixtures.formulaModel,
  check: {
    ...activityContentFixtures.formulaModel.check,
    answer: 9,
    inputs: [{ name: "time", value: 6 }],
    output: "increase",
    unit: "hits",
  },
  fields: {
    compareAt: 3,
    outputs: [
      { formula: "3 * time + 2", id: "hits", label: "Predicted hits", unit: "hits" },
      { formula: "3 * (time - 3)", id: "increase", label: "Increase from 3 seconds", unit: "hits" },
    ],
    variables: [
      { initial: 3, label: "Run time", max: 10, min: 0, name: "time", step: 1, unit: "seconds" },
    ],
  },
} as const;

describe("walkthrough lesson polish", () => {
  afterEach(() => {
    language.current = "en";
  });

  it("calls only an accepted estimate close and keeps rejected estimates out of that verdict", async () => {
    const wrong = openActivity({ content: estimate, template: "guessReveal" });
    await valueInput().fill("970000");
    await checkActivity();
    await expectVerdict("Not quite");

    await expect
      .element(page.getByText("Your guess is close to the real value."))
      .not.toBeInTheDocument();

    wrong.unmount();

    openActivity({ content: estimate, template: "guessReveal" });
    await valueInput().fill("720000");
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("Your guess is close to the real value.")).toBeVisible();
    await expect.element(page.getByText(/Saved to your mistakes/u)).not.toBeInTheDocument();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
  });

  it("formats one atom in the scale's text alternative", async () => {
    openActivity({ content: estimate, template: "guessReveal" });

    await expect
      .element(page.getByText("A scale from 1 atom to 1,000,000,000 atoms.", { exact: true }))
      .toBeInTheDocument();
  });

  it("formats zero, one and several seconds as the slider moves", async () => {
    openActivity({ content: detector, template: "formulaModel" });
    await pressOnSlider("Run time", "Home", 1);

    await expect
      .element(page.getByRole("slider", { name: "Run time" }))
      .toHaveAttribute("aria-valuetext", "0\u00A0seconds. Increase from 3 seconds: −9\u00A0hits");

    await press("ArrowRight");

    await expect
      .element(page.getByRole("slider", { name: "Run time" }))
      .toHaveAttribute("aria-valuetext", "1\u00A0second. Increase from 3 seconds: −6\u00A0hits");

    await press("ArrowRight");

    await expect
      .element(page.getByRole("slider", { name: "Run time" }))
      .toHaveAttribute("aria-valuetext", "2\u00A0seconds. Increase from 3 seconds: −3\u00A0hits");
  });

  it("inflects the lesson's Portuguese unit words on the slider and scale", async () => {
    language.current = "pt";

    const slider = openActivity({
      content: {
        ...detector,
        fields: {
          ...detector.fields,
          variables: [{ ...detector.fields.variables[0], initial: 1, unit: "segundos" }],
        },
      },
      template: "formulaModel",
    });

    await expect
      .element(page.getByRole("slider", { name: "Run time" }))
      .toHaveAttribute("aria-valuetext", expect.stringMatching(/^1\ssegundo\./u));

    await pressOnSlider("Run time", "ArrowRight", 1);

    await expect
      .element(page.getByRole("slider", { name: "Run time" }))
      .toHaveAttribute("aria-valuetext", expect.stringMatching(/^2\ssegundos\./u));

    slider.unmount();

    openActivity({
      content: { ...estimate, fields: { ...estimate.fields, unit: "átomos" } },
      template: "guessReveal",
    });

    await expect
      .element(page.getByText("A scale from 1 átomo to 1.000.000.000 átomos.", { exact: true }))
      .toBeInTheDocument();
  });

  it("names the plotted change beside its comparison value", async () => {
    openActivity({ content: detector, template: "formulaModel" });
    await expect.element(page.getByText("11 hits", { exact: true })).toBeVisible();

    await expect
      .element(page.getByText("Increase from 3 seconds at 3 seconds: 0 hits", { exact: true }))
      .toBeVisible();
  });

  it("puts a keyboard learner in the written answer on arrival", async () => {
    const typed = teachingStep("typedAnswer");
    const lesson = buildLesson([teachingStep("explanation"), typed, teachingStep("summary")]);

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { checkStep: acceptedAnswerCheck(typed) }),
      lesson,
    });

    await press("Enter");
    const answer = page.getByRole("textbox", { name: typed.content.question });
    await expect.element(answer).toHaveFocus();
    await userEvent.keyboard("It shows where the electron is likely to be");
    await press("Enter");
    await expectVerdict("Correct!");
    await press("Enter");
    await expect.element(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  });
});

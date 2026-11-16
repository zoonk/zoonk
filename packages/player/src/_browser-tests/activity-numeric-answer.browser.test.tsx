import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import {
  checkActivity,
  expectVerdict,
  openActivity,
  valueInput,
} from "../_test-utils/activity-player";

function numericGroup() {
  return valueInput().element().closest('[data-slot="input-group"]')!;
}

describe("activity numeric answers", () => {
  it("the calculator uses whole-number wording for zero decimal places", async () => {
    openActivity({ content: engineModeFixtures.formulaModel.calculator, template: "formulaModel" });
    await expect.element(page.getByText("A whole number.", { exact: true })).toBeVisible();

    await expect
      .element(page.getByText("Round to 0 decimal places.", { exact: true }))
      .not.toBeInTheDocument();

    await valueInput().fill("251.54");
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it.each([
    { token: "--success", value: "0.5", verdict: "Correct!" },
    { token: "--destructive", value: "0.7", verdict: "Not quite" },
  ] as const)(
    "Enter keeps the $verdict border while the answer has focus",
    async ({ value, verdict, token }) => {
      openActivity({ template: "unitCircle" });
      await valueInput().fill(value);
      await userEvent.keyboard("{Enter}");
      await expectVerdict(verdict);
      expect(document.activeElement).toBe(valueInput().element());
      const color = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
      await expect.poll(() => getComputedStyle(numericGroup()).borderTopColor).toBe(color);
    },
  );

  it.each([
    { places: 1, tolerance: 0.05, value: "0.2" },
    { places: 2, tolerance: 0.005, value: "0.17" },
    { places: 2, tolerance: 0.000001, value: "0.17" },
  ])(
    "the hint at tolerance $tolerance asks for $places places and grading takes it",
    async ({ tolerance, places, value }) => {
      const fixture = activityContentFixtures.unitCircle;

      openActivity({
        content: {
          ...fixture,
          check: {
            ...fixture.check,
            answer: 0.1667,
            tolerance: { kind: "absolute", value: tolerance },
          },
        },
        template: "unitCircle",
      });

      const rule =
        places === 1 ? "Round to 1 decimal place." : `Round to ${places} decimal places.`;

      await expect.element(page.getByText(rule, { exact: true })).toBeVisible();
      await valueInput().fill(value);
      await checkActivity();
      await expectVerdict("Correct!");
    },
  );
});

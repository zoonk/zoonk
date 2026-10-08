import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { type Locator, page } from "vitest/browser";
import {
  checkActivity,
  expectVerdict,
  focusOn,
  openActivity,
  press,
  pressOnSlider,
  valueInput,
} from "../_test-utils/activity-player";

/**
 * Vitest's `toBeVisible` takes only HTML and SVG elements, so rendered math (a MathML `math` element)
 * is checked the way Playwright's `toBeVisible` checks any element: rendered, not hidden by style,
 * and with a box on the page.
 */
async function expectMathVisible(math: Locator) {
  await expect.poll(() => hasVisibleBox(math.query())).toBe(true);
}

function hasVisibleBox(element: Element | null) {
  if (!element?.checkVisibility({ visibilityProperty: true })) {
    return false;
  }

  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
}

describe("any-subject activities", () => {
  it("predict then reveal: a close guess shows the real value", async () => {
    openActivity({ template: "predictReveal" });
    await expect.element(page.getByText("Drag to guess")).toBeVisible();
    await valueInput().fill("14");
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("Real value: 14 times")).toBeVisible();
    await expect.element(page.getByText("The map stretches land near the poles.")).toBeVisible();
  });

  it("predict then reveal: a far guess says how far", async () => {
    openActivity({ template: "predictReveal" });
    await valueInput().fill("3");
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("Your guess is about 4.7 times too small.")).toBeVisible();
  });

  it("before and after: the change is computed once checked", async () => {
    openActivity({ template: "beforeAfter" });
    await expect.element(page.getByRole("region", { name: "1914" })).not.toBeInTheDocument();
    await page.getByRole("button", { name: "Show after: 1914" }).click();

    await expect
      .element(page.getByRole("region", { name: "1914" }).getByText("1.5", { exact: true }))
      .toBeVisible();

    await valueInput().fill("0.12");
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("8.3 times less")).toBeVisible();
  });

  it("before and after: a wrong ratio is marked", async () => {
    openActivity({ template: "beforeAfter" });
    await valueInput().fill("8");
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByRole("region", { name: "1914" })).toBeVisible();
  });

  it("activities render lesson math in the prompt and the reveal", async () => {
    const fixture = activityContentFixtures.predictReveal;

    openActivity({
      content: {
        ...fixture,
        fields: { ...fixture.fields, explanation: "Africa is about $14 \\times$ Greenland." },
        prompt: "How many Greenlands fit in $A_{Africa}$?",
      },
      template: "predictReveal",
    });

    const prompt = page.getByRole("heading", { name: /How many Greenlands fit in/u });

    await expectMathVisible(prompt.getByRole("math"));
    await expect.element(prompt).not.toMatchTextContent("$");

    await valueInput().fill("14");
    await checkActivity();
    await expectMathVisible(page.getByRole("figure").getByRole("math"));
  });
});

describe("any-subject activities with a keyboard", () => {
  it("predict then reveal: arrow keys place the guess", async () => {
    openActivity({ template: "predictReveal" });
    await pressOnSlider("Your guess", "ArrowRight", 10);
    await expect.element(page.getByText(/^Your guess: /u)).toBeVisible();
    await expect.element(valueInput()).not.toHaveValue("");
  });

  it("before and after: showing the after state moves focus to it", async () => {
    openActivity({ template: "beforeAfter" });
    await focusOn(page.getByRole("button", { name: "Show after: 1914" }));
    await press("Enter");
    await expect.element(page.getByRole("region", { name: "1914" })).toHaveFocus();
  });
});

import { choiceCheck } from "@zoonk/testing/fixtures/activity-checks";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import {
  checkActivity,
  dragBy,
  dragOnto,
  expectCount,
  expectVerdict,
  focusOn,
  openActivity,
  press,
  pressOnSlider,
  valueInput,
} from "../_test-utils/activity-player";

const fixtures = activityContentFixtures;

/** A cause or effect card, named by its year and label. */
function chainNode(name: string) {
  return page.getByRole("button", { exact: true, name });
}

/** The timeline with a question instead of an order check: the learner reveals the dates. */
const timelineQuestion = {
  ...fixtures.timeline,
  check: choiceCheck("Cleopatra lived closer in time to...", [
    ["The Moon landing", true],
    ["The pyramid builders", false],
  ]),
};

/** The chain with a question: each link is confirmed or turned down at once. */
const chainQuestion = {
  ...fixtures.causeEffectChain,
  check: choiceCheck("Why did the storms get so bad?", [
    ["Plowing and drought together", true],
    ["Only the drought", false],
  ]),
};

describe("money and society activities", () => {
  it("slider calculator: moving the extra payment gives the months to check", async () => {
    openActivity({ template: "sliderCalculator" });
    await pressOnSlider("Extra per month", "ArrowRight", 4);

    await expect.element(valueInput()).toHaveValue("251.54");
    await expect.element(page.getByText(/^−[\d.]+ from the start$/u)).toBeVisible();
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("slider calculator: a number that isn't the model's is wrong", async () => {
    openActivity({ mode: "fun", template: "sliderCalculator" });
    await valueInput().fill("300");
    await checkActivity();
    await expectVerdict("Not quite");
  });

  it("scenario simulator: the rent event and the price give the profit", async () => {
    openActivity({ mode: "fun", template: "scenarioSimulator" });
    await page.getByRole("button", { name: "Rent goes up $500" }).click();

    await expect
      .element(page.getByRole("button", { name: "Rent goes up $500" }))
      .toHaveAttribute("aria-pressed", "true");

    await pressOnSlider("Price per cup", "ArrowRight", 2);
    await expect.element(page.getByText("$1,500 before", { exact: true })).toBeVisible();
    await expect.element(valueInput()).toHaveValue("1000");
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("scenario simulator: leaving the event off gives the wrong profit", async () => {
    openActivity({ template: "scenarioSimulator" });
    await pressOnSlider("Price per cup", "ArrowRight", 2);
    await expect.element(valueInput()).toHaveValue("1500");
    await checkActivity();
    await expectVerdict("Not quite");
  });

  it("supply and demand: moving supply left explains the spike", async () => {
    openActivity({ template: "supplyDemand" });
    await pressOnSlider("Move the supply curve", "ArrowLeft", 1);
    await expect.element(page.getByText("Price goes up", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Quantity goes down", { exact: true })).toBeVisible();
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("supply and demand: moving demand gets the wrong-curve feedback", async () => {
    openActivity({ mode: "fun", template: "supplyDemand" });
    await pressOnSlider("Move the demand curve", "ArrowRight", 2);
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("People didn't want more eggs.")).toBeVisible();
    await expect.element(page.getByText("Supply moved left.")).toBeVisible();
  });

  it("timeline: events placed in order are right, and the real gaps show", async () => {
    openActivity({ mode: "fun", template: "timeline" });
    await page.getByRole("button", { name: "Place Moon landing on the timeline" }).click();
    await press("End");

    await expect
      .element(page.getByRole("slider", { name: "Moon landing" }))
      .toHaveAttribute("aria-valuetext", "2000 CE");

    await page.getByRole("button", { name: "Place Cleopatra rules Egypt on the timeline" }).click();

    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("about 2,000 years")).toBeVisible();
    await expect.element(page.getByText("about 2,500 years")).toBeVisible();
  });

  it("timeline: events in the wrong order are wrong, with the real dates", async () => {
    openActivity({ template: "timeline" });
    await page.getByRole("button", { name: "Place Moon landing on the timeline" }).click();
    await page.getByRole("button", { name: "Place Cleopatra rules Egypt on the timeline" }).click();

    await press("End");
    await checkActivity();
    await expectVerdict("Not quite");

    await expect
      .element(page.getByRole("slider", { name: "Cleopatra rules Egypt" }))
      .toHaveAttribute("aria-valuetext", "51 BCE. Your guess: 2000 CE");
  });

  it("timeline: with a question, the real dates show before answering", async () => {
    openActivity({ content: timelineQuestion, mode: "fun", template: "timeline" });
    await page.getByRole("button", { name: "Place Moon landing on the timeline" }).click();
    await page.getByRole("button", { name: "Place Cleopatra rules Egypt on the timeline" }).click();

    await page.getByRole("button", { name: "Show the real dates" }).click();
    await expect.element(page.getByText("about 2,000 years")).toBeVisible();
    await page.getByRole("radio", { name: /The Moon landing/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("map explorer: tapping places uncovers what's there", async () => {
    openActivity({ template: "mapExplorer" });
    await page.getByRole("button", { name: "Brewery on Broad Street" }).click();
    await expect.element(page.getByText(/Over 70 workers and no cholera deaths/u)).toBeVisible();
    await page.getByRole("button", { name: "Poland Street workhouse" }).click();
    await expect.element(page.getByText(/535 people lived here/u)).toBeVisible();
    await expect.element(page.getByText("2 of 3 explored")).toBeVisible();

    await page
      .getByRole("radio", { name: "Their water didn't come from the Broad Street pump" })
      .click();

    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("map explorer: the wrong conclusion is marked wrong", async () => {
    openActivity({ mode: "fun", template: "mapExplorer" });
    await page.getByRole("button", { name: "Broad Street pump" }).click();
    await page.getByRole("radio", { name: /air in their buildings/u }).click();
    await checkActivity();
    await expectVerdict("Not quite");
  });

  it("cause and effect: linking both causes to the storms is right", async () => {
    openActivity({ mode: "fun", template: "causeEffectChain" });
    await chainNode("1920 Prairie plowed for wheat").click();
    await chainNode("1934 Dust storms").click();
    await chainNode("1931 Years of drought").click();
    await chainNode("1934 Dust storms").click();
    await expect.element(page.getByText("2 of 2 links")).toBeVisible();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("Bare soil blew away.")).toBeVisible();
  });

  it("cause and effect: a backward link is wrong and the missed ones show", async () => {
    openActivity({ template: "causeEffectChain" });
    await chainNode("1934 Dust storms").click();
    await chainNode("1920 Prairie plowed for wheat").click();
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("Not a link in this story")).toBeVisible();
    await expectCount(page.getByText("Missed link"), 2);
  });

  it("cause and effect: with a question, each link is confirmed at once", async () => {
    openActivity({ content: chainQuestion, mode: "fun", template: "causeEffectChain" });
    await chainNode("1934 Dust storms").click();
    await chainNode("1920 Prairie plowed for wheat").click();
    await expect.element(page.getByText(/didn't lead straight to/u)).toBeVisible();
    await chainNode("1920 Prairie plowed for wheat").click();
    await chainNode("1934 Dust storms").click();
    await expect.element(page.getByText("Bare soil blew away.")).toBeVisible();
    await page.getByRole("radio", { name: /Plowing and drought together/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("source comparison: marking both claims is right", async () => {
    openActivity({ template: "sourceComparison" });
    await page.getByRole("checkbox", { name: "The regulars fired on us" }).click();
    await page.getByRole("checkbox", { name: "the rebels fired first" }).click();
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("source comparison: marking one of two shows the one missed", async () => {
    openActivity({ mode: "fun", template: "sourceComparison" });
    await page.getByRole("checkbox", { name: "The regulars fired on us" }).click();
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("Missed", { exact: true })).toBeVisible();
  });
});

describe("money and society activities by dragging", () => {
  it("timeline: dragging an event onto the axis places it where it's dropped", async () => {
    openActivity({ template: "timeline" });
    const track = page.getByRole("figure");
    await expect.element(track).toBeVisible();

    await dragOnto(
      page.getByRole("button", { name: "Place Moon landing on the timeline" }),
      track,
      { targetPosition: { x: track.element().getBoundingClientRect().width / 2, y: 40 } },
    );

    const placed = page.getByRole("slider", { name: "Moon landing" });
    await expect.element(placed).toBeVisible();
    await expect.element(placed).toHaveAttribute("aria-valuetext", expect.stringMatching(/BCE/u));
  });

  it("supply and demand: dragging the supply handle left raises the price", async () => {
    openActivity({ template: "supplyDemand" });
    await dragBy(page.getByRole("slider", { name: "Move the supply curve" }), { x: -60, y: 0 });

    await expect.element(page.getByText("Price goes up", { exact: true })).toBeVisible();
    await checkActivity();
    await expectVerdict("Correct!");
  });
});

describe("money and society activities with a keyboard only", () => {
  it("slider calculator", async () => {
    openActivity({ template: "sliderCalculator" });
    await pressOnSlider("Extra per month", "ArrowRight", 4);
    await focusOn(page.getByRole("button", { name: "Check" }));
    await press("Enter");
    await expectVerdict("Correct!");
  });

  it("scenario simulator", async () => {
    openActivity({ template: "scenarioSimulator" });
    await focusOn(page.getByRole("button", { name: "Rent goes up $500" }));
    await press("Space");
    await press("Tab");
    await expect.element(page.getByRole("slider", { name: "Price per cup" })).toHaveFocus();
    await press("ArrowRight", 2);
    await focusOn(page.getByRole("button", { name: "Check" }));
    await press("Enter");
    await expectVerdict("Correct!");
  });

  it("supply and demand", async () => {
    openActivity({ template: "supplyDemand" });
    await pressOnSlider("Move the supply curve", "ArrowLeft", 2);
    await press("Enter");
    await expectVerdict("Correct!");
  });

  it("timeline", async () => {
    openActivity({ template: "timeline" });
    await focusOn(page.getByRole("button", { name: "Place Moon landing on the timeline" }));
    await press("Enter");
    await expect.element(page.getByRole("slider", { name: "Moon landing" })).toHaveFocus();
    await press("End");
    await press("Tab");
    await press("Enter");
    await expect.element(page.getByRole("slider", { name: "Cleopatra rules Egypt" })).toHaveFocus();
    await press("Enter");
    await expectVerdict("Correct!");
  });

  it("map explorer", async () => {
    openActivity({ template: "mapExplorer" });
    await focusOn(page.getByRole("button", { name: "Broad Street pump" }));
    await press("Enter");
    await expect.element(page.getByText(/Most of the deaths were in houses/u)).toBeVisible();
    await press("1");
    await focusOn(page.getByRole("button", { name: "Check" }));
    await press("Enter");
    await expectVerdict("Correct!");
  });

  it("cause and effect", async () => {
    openActivity({ template: "causeEffectChain" });
    const plow = chainNode("1920 Prairie plowed for wheat");
    const drought = chainNode("1931 Years of drought");
    const dust = chainNode("1934 Dust storms");

    await focusOn(plow);
    await press("Enter");
    await focusOn(dust);
    await press("Enter");
    await focusOn(drought);
    await press("Enter");
    await press("Escape");
    await expect.element(page.getByText("Pick a cause, then pick what it led to.")).toBeVisible();
    await press("Enter");
    await focusOn(dust);
    await press("Enter");
    await expect.element(page.getByText("2 of 2 links")).toBeVisible();
    await focusOn(page.getByRole("button", { name: "Check" }));
    await press("Enter");
    await expectVerdict("Correct!");
  });

  it("source comparison", async () => {
    openActivity({ template: "sourceComparison" });
    await focusOn(page.getByRole("checkbox", { name: "The regulars fired on us" }));
    await press("Space");
    await press("Tab");
    await press("Enter");

    await expect
      .element(page.getByRole("checkbox", { name: "the rebels fired first" }))
      .toHaveAttribute("aria-checked", "true");

    await focusOn(page.getByRole("button", { name: "Check" }));
    await press("Enter");
    await expectVerdict("Correct!");
  });
});

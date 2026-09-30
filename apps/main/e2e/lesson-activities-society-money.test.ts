import { choiceCheck } from "@zoonk/testing/fixtures/activity-checks";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import {
  checkActivity,
  expectVerdict,
  openActivity,
  pressOnSlider,
  valueInput,
} from "./activity-lesson";
import { type Page, expect, test } from "./fixtures";
import { MODES } from "./learn-personas";

async function press(page: Page, key: string, times = 1) {
  for (const _ of Array.from({ length: times })) {
    // oxlint-disable-next-line no-await-in-loop -- Each key press moves one step.
    await page.keyboard.press(key);
  }
}

const fixtures = activityContentFixtures;

/** A cause or effect card, named by its year and label. */
function chainNode(page: Page, name: string) {
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

for (const mode of MODES) {
  test.describe(`money and society activities in ${mode} mode`, () => {
    test("slider calculator: moving the extra payment gives the months to check", async ({
      page,
    }) => {
      await openActivity(page, { mode, template: "sliderCalculator" });
      await pressOnSlider(page, "Extra per month", "ArrowRight", 4);

      await expect(valueInput(page)).toHaveValue("251.54");

      await expect(page.getByText(/^−[\d.]+ from the start$/u)).toBeVisible();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("slider calculator: a number that isn't the model's is wrong", async ({ page }) => {
      await openActivity(page, { mode, template: "sliderCalculator" });
      await valueInput(page).fill("300");
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
    });

    test("scenario simulator: the rent event and the price give the profit", async ({ page }) => {
      await openActivity(page, { mode, template: "scenarioSimulator" });
      await page.getByRole("button", { name: "Rent goes up $500" }).click();

      await expect(page.getByRole("button", { name: "Rent goes up $500" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );

      await pressOnSlider(page, "Price per cup", "ArrowRight", 2);
      await expect(page.getByText("$1,500 before", { exact: true })).toBeVisible();
      await expect(valueInput(page)).toHaveValue("1000");
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("scenario simulator: leaving the event off gives the wrong profit", async ({ page }) => {
      await openActivity(page, { mode, template: "scenarioSimulator" });
      await pressOnSlider(page, "Price per cup", "ArrowRight", 2);
      await expect(valueInput(page)).toHaveValue("1500");
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
    });

    test("supply and demand: moving supply left explains the spike", async ({ page }) => {
      await openActivity(page, { mode, template: "supplyDemand" });
      await pressOnSlider(page, "Move the supply curve", "ArrowLeft", 1);
      await expect(page.getByText("Price goes up", { exact: true })).toBeVisible();
      await expect(page.getByText("Quantity goes down", { exact: true })).toBeVisible();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("supply and demand: moving demand gets the wrong-curve feedback", async ({ page }) => {
      await openActivity(page, { mode, template: "supplyDemand" });
      await pressOnSlider(page, "Move the demand curve", "ArrowRight", 2);
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("People didn't want more eggs.")).toBeVisible();
      await expect(page.getByText("Supply moved left.")).toBeVisible();
    });

    test("timeline: events placed in order are right, and the real gaps show", async ({ page }) => {
      await openActivity(page, { mode, template: "timeline" });
      await page.getByRole("button", { name: "Place Moon landing on the timeline" }).click();
      await press(page, "End");

      await expect(page.getByRole("slider", { name: "Moon landing" })).toHaveAttribute(
        "aria-valuetext",
        "2000 CE",
      );

      await page
        .getByRole("button", { name: "Place Cleopatra rules Egypt on the timeline" })
        .click();

      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("about 2,000 years")).toBeVisible();
      await expect(page.getByText("about 2,500 years")).toBeVisible();
    });

    test("timeline: events in the wrong order are wrong, with the real dates", async ({ page }) => {
      await openActivity(page, { mode, template: "timeline" });
      await page.getByRole("button", { name: "Place Moon landing on the timeline" }).click();

      await page
        .getByRole("button", { name: "Place Cleopatra rules Egypt on the timeline" })
        .click();

      await press(page, "End");
      await checkActivity(page);
      await expectVerdict(page, "Not quite");

      await expect(page.getByRole("slider", { name: "Cleopatra rules Egypt" })).toHaveAttribute(
        "aria-valuetext",
        "51 BCE. Your guess: 2000 CE",
      );
    });

    test("timeline: with a question, the real dates show before answering", async ({ page }) => {
      await openActivity(page, { content: timelineQuestion, mode, template: "timeline" });
      await page.getByRole("button", { name: "Place Moon landing on the timeline" }).click();

      await page
        .getByRole("button", { name: "Place Cleopatra rules Egypt on the timeline" })
        .click();

      await page.getByRole("button", { name: "Show the real dates" }).click();
      await expect(page.getByText("about 2,000 years")).toBeVisible();
      await page.getByRole("radio", { name: /The Moon landing/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("map explorer: tapping places uncovers what's there", async ({ page }) => {
      await openActivity(page, { mode, template: "mapExplorer" });
      await page.getByRole("button", { name: "Brewery on Broad Street" }).click();
      await expect(page.getByText(/Over 70 workers and no cholera deaths/u)).toBeVisible();
      await page.getByRole("button", { name: "Poland Street workhouse" }).click();
      await expect(page.getByText(/535 people lived here/u)).toBeVisible();
      await expect(page.getByText("2 of 3 explored")).toBeVisible();
      await page.getByRole("radio", { name: /didn't come from the Broad Street pump/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("map explorer: the wrong conclusion is marked wrong", async ({ page }) => {
      await openActivity(page, { mode, template: "mapExplorer" });
      await page.getByRole("button", { name: "Broad Street pump" }).click();
      await page.getByRole("radio", { name: /air in their buildings/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
    });

    test("cause and effect: linking both causes to the storms is right", async ({ page }) => {
      await openActivity(page, { mode, template: "causeEffectChain" });
      await chainNode(page, "1920 Prairie plowed for wheat").click();
      await chainNode(page, "1934 Dust storms").click();
      await chainNode(page, "1931 Years of drought").click();
      await chainNode(page, "1934 Dust storms").click();
      await expect(page.getByText("2 of 2 links")).toBeVisible();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("Bare soil blew away.")).toBeVisible();
    });

    test("cause and effect: a backward link is wrong and the missed ones show", async ({
      page,
    }) => {
      await openActivity(page, { mode, template: "causeEffectChain" });
      await chainNode(page, "1934 Dust storms").click();
      await chainNode(page, "1920 Prairie plowed for wheat").click();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("Not a link in this story")).toBeVisible();
      await expect(page.getByText("Missed link")).toHaveCount(2);
    });

    test("cause and effect: with a question, each link is confirmed at once", async ({ page }) => {
      await openActivity(page, { content: chainQuestion, mode, template: "causeEffectChain" });
      await chainNode(page, "1934 Dust storms").click();
      await chainNode(page, "1920 Prairie plowed for wheat").click();
      await expect(page.getByText(/didn't lead straight to/u)).toBeVisible();
      await chainNode(page, "1920 Prairie plowed for wheat").click();
      await chainNode(page, "1934 Dust storms").click();
      await expect(page.getByText("Bare soil blew away.")).toBeVisible();
      await page.getByRole("radio", { name: /Plowing and drought together/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("source comparison: marking both claims is right", async ({ page }) => {
      await openActivity(page, { mode, template: "sourceComparison" });
      await page.getByRole("checkbox", { name: "The regulars fired on us" }).click();
      await page.getByRole("checkbox", { name: "the rebels fired first" }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("source comparison: marking one of two shows the one missed", async ({ page }) => {
      await openActivity(page, { mode, template: "sourceComparison" });
      await page.getByRole("checkbox", { name: "The regulars fired on us" }).click();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("Missed", { exact: true })).toBeVisible();
    });
  });
}

test.describe("money and society activities by dragging", () => {
  test("timeline: dragging an event onto the axis places it where it's dropped", async ({
    page,
  }) => {
    await openActivity(page, { mode: "focus", template: "timeline" });
    const track = page.getByRole("figure");
    const box = await track.boundingBox();

    await page
      .getByRole("button", { name: "Place Moon landing on the timeline" })
      .dragTo(track, { steps: 8, targetPosition: { x: (box?.width ?? 0) / 2, y: 40 } });

    const placed = page.getByRole("slider", { name: "Moon landing" });
    await expect(placed).toBeVisible();
    await expect(placed).toHaveAttribute("aria-valuetext", /BCE/u);
  });

  test("supply and demand: dragging the supply handle left raises the price", async ({ page }) => {
    await openActivity(page, { mode: "focus", template: "supplyDemand" });
    const handle = page.getByRole("slider", { name: "Move the supply curve" });
    const box = await handle.boundingBox();
    const [x, y] = [(box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2];

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 60, y, { steps: 6 });
    await page.mouse.up();

    await expect(page.getByText("Price goes up", { exact: true })).toBeVisible();
    await checkActivity(page);
    await expectVerdict(page, "Correct!");
  });
});

test.describe("money and society activities with a keyboard only", () => {
  test("slider calculator", async ({ page }) => {
    await openActivity(page, { mode: "focus", template: "sliderCalculator" });
    await pressOnSlider(page, "Extra per month", "ArrowRight", 4);
    await page.getByRole("button", { name: "Check" }).focus();
    await press(page, "Enter");
    await expectVerdict(page, "Correct!");
  });

  test("scenario simulator", async ({ page }) => {
    await openActivity(page, { mode: "focus", template: "scenarioSimulator" });
    await page.getByRole("button", { name: "Rent goes up $500" }).focus();
    await press(page, "Space");
    await press(page, "Tab");
    await expect(page.getByRole("slider", { name: "Price per cup" })).toBeFocused();
    await press(page, "ArrowRight", 2);
    await page.getByRole("button", { name: "Check" }).focus();
    await press(page, "Enter");
    await expectVerdict(page, "Correct!");
  });

  test("supply and demand", async ({ page }) => {
    await openActivity(page, { mode: "focus", template: "supplyDemand" });
    await pressOnSlider(page, "Move the supply curve", "ArrowLeft", 2);
    await press(page, "Enter");
    await expectVerdict(page, "Correct!");
  });

  test("timeline", async ({ page }) => {
    await openActivity(page, { mode: "focus", template: "timeline" });
    await page.getByRole("button", { name: "Place Moon landing on the timeline" }).focus();
    await press(page, "Enter");
    await expect(page.getByRole("slider", { name: "Moon landing" })).toBeFocused();
    await press(page, "End");
    await press(page, "Tab");
    await press(page, "Enter");
    await expect(page.getByRole("slider", { name: "Cleopatra rules Egypt" })).toBeFocused();
    await press(page, "Enter");
    await expectVerdict(page, "Correct!");
  });

  test("map explorer", async ({ page }) => {
    await openActivity(page, { mode: "focus", template: "mapExplorer" });
    await page.getByRole("button", { name: "Broad Street pump" }).focus();
    await press(page, "Enter");
    await expect(page.getByText(/Most of the deaths were in houses/u)).toBeVisible();
    await press(page, "1");
    await page.getByRole("button", { name: "Check" }).focus();
    await press(page, "Enter");
    await expectVerdict(page, "Correct!");
  });

  test("cause and effect", async ({ page }) => {
    await openActivity(page, { mode: "focus", template: "causeEffectChain" });
    const plow = chainNode(page, "1920 Prairie plowed for wheat");
    const drought = chainNode(page, "1931 Years of drought");
    const dust = chainNode(page, "1934 Dust storms");

    await plow.focus();
    await press(page, "Enter");
    await dust.focus();
    await press(page, "Enter");
    await drought.focus();
    await press(page, "Enter");
    await press(page, "Escape");
    await expect(page.getByText("Pick a cause, then pick what it led to.")).toBeVisible();
    await press(page, "Enter");
    await dust.focus();
    await press(page, "Enter");
    await expect(page.getByText("2 of 2 links")).toBeVisible();
    await page.getByRole("button", { name: "Check" }).focus();
    await press(page, "Enter");
    await expectVerdict(page, "Correct!");
  });

  test("source comparison", async ({ page }) => {
    await openActivity(page, { mode: "focus", template: "sourceComparison" });
    await page.getByRole("checkbox", { name: "The regulars fired on us" }).focus();
    await press(page, "Space");
    await press(page, "Tab");
    await press(page, "Enter");

    await expect(page.getByRole("checkbox", { name: "the rebels fired first" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.getByRole("button", { name: "Check" }).focus();
    await press(page, "Enter");
    await expectVerdict(page, "Correct!");
  });
});

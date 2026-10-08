import { interactionCheck } from "@zoonk/testing/fixtures/activity-checks";
import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import {
  checkActivity,
  expectCount,
  expectVerdict,
  focusOn,
  openActivity,
  press,
  pressOnSlider,
  valueInput,
} from "../_test-utils/activity-player";

/** The Punnett fixture graded on the filled square itself instead of a question about it. */
const FILL_THE_SQUARE = { ...activityContentFixtures.punnettSquare, check: interactionCheck };

const HEART_MIX_UP = "The drawing faces you, so the heart's right side is on your left.";

/** Spots number the heart's parts by where their pins sit, top to bottom, left to right. */
const HEART_SPOTS = ["Aorta", "Right atrium", "Left atrium", "Right ventricle", "Left ventricle"];

const PHOTOSYNTHESIS = [
  "Chlorophyll absorbs sunlight",
  "Water is split, releasing oxygen",
  "Light energy is stored in ATP and NADPH",
  "The Calvin cycle builds sugar from CO₂",
  "The plant stores sugar as starch",
];

async function labelSpots(names: readonly string[]) {
  for (const [index, name] of names.entries()) {
    // oxlint-disable-next-line no-await-in-loop -- Each name goes on the next spot in turn.
    await page
      .getByRole("button", { exact: true, name: `Put ${name} on spot ${index + 1}` })
      .click();
  }
}

async function fillSquare(genotypes: readonly string[]) {
  for (const [index, genotype] of genotypes.entries()) {
    // oxlint-disable-next-line no-await-in-loop -- The palette fills one square at a time.
    await page
      .getByRole("button", { exact: true, name: `Put ${genotype} in square ${index + 1}` })
      .click();
  }
}

function moveStatus() {
  return page.getByRole("status").filter({ hasText: /is over position|dropped at position/u });
}

function stepOrder(): string[] {
  return page
    .getByRole("list", { name: "Steps, in your order" })
    .getByRole("button")
    .elements()
    .map((button) => button.getAttribute("aria-label") ?? "");
}

/**
 * Moves a step with the keyboard: Space picks it up, arrows move it, Space drops it. Each press
 * waits for the list to announce the last one: the list measures its rows only once the step is
 * picked up, and each arrow moves from where the list says the step is now. The move ends once the
 * step sits at its new place, so the next move reads the order this one left.
 */
async function moveStep({ from, step, to }: { from: number; step: string; to: number }) {
  const key = to < from ? "ArrowUp" : "ArrowDown";
  const direction = to < from ? -1 : 1;

  await focusOn(page.getByRole("button", { exact: true, name: step }));
  await press("Space");
  await expect.element(moveStatus()).toMatchTextContent(`${step} is over position ${from}.`);

  for (const position of Array.from(
    { length: Math.abs(to - from) },
    (_, index) => from + direction * (index + 1),
  )) {
    // oxlint-disable-next-line no-await-in-loop -- Each arrow moves the step one place.
    await press(key);
    // oxlint-disable-next-line no-await-in-loop -- The next arrow moves from where this one left it.
    await expect.element(moveStatus()).toMatchTextContent(`${step} is over position ${position}.`);
  }

  await press("Space");
  await expect.element(moveStatus()).toMatchTextContent(`${step} dropped at position ${to}.`);
  await expect.poll(() => stepOrder()[to - 1]).toBe(step);
}

async function sortSteps(expected: readonly string[]) {
  await expectCount(
    page.getByRole("list", { name: "Steps, in your order" }).getByRole("button"),
    PHOTOSYNTHESIS.length,
  );

  for (const [index, step] of expected.entries()) {
    const current = stepOrder().indexOf(step);

    if (current !== index) {
      // oxlint-disable-next-line no-await-in-loop -- Each move depends on the order the last one left.
      await moveStep({ from: current + 1, step, to: index + 1 });
    }
  }
}

async function buildCarbonDioxide({ doubleBonds }: { doubleBonds: boolean }) {
  await page.getByRole("button", { name: "Add Carbon" }).click();
  await page.getByRole("button", { name: "Add Oxygen bonded to Carbon 1" }).click();
  await page.getByRole("button", { name: "Add Oxygen bonded to Carbon 1" }).click();

  if (doubleBonds) {
    await page.getByRole("button", { name: "Oxygen 1: 1 of 2 bonds" }).click();
    await page.getByRole("button", { name: "Oxygen 2: 1 of 2 bonds" }).click();
  }
}

describe("science activities", () => {
  it("parameter simulation: moving the angle to 45° gives the farthest throw", async () => {
    openActivity({ template: "parameterSimulation" });
    await expect.element(page.getByText("Peak height", { exact: true })).toBeVisible();
    await pressOnSlider("Launch angle", "ArrowRight", 15);
    await expect.element(valueInput()).toHaveValue("40.77");
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("parameter simulation: stopping at another angle is wrong", async () => {
    openActivity({ template: "parameterSimulation" });
    await pressOnSlider("Launch angle", "ArrowRight", 5);
    await expect.element(valueInput()).toHaveValue("38.32");
    await checkActivity();
    await expectVerdict("Not quite");
  });

  it("labeled diagram: every name on its part is right", async () => {
    openActivity({ template: "labeledDiagram" });
    await expect.element(page.getByText("Low in oxygen")).toBeVisible();
    await labelSpots(HEART_SPOTS);

    await expect
      .element(page.getByText("Every spot has a name. Tap a spot to change it."))
      .toBeVisible();

    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("labeled diagram: a swapped pair shows the writer's mix-up feedback", async () => {
    openActivity({ template: "labeledDiagram" });

    await labelSpots(["Aorta", "Left atrium", "Right atrium", "Right ventricle", "Left ventricle"]);

    await page.getByRole("button", { name: "Spot 5, bottom right: Left ventricle" }).click();

    await expect
      .element(page.getByRole("button", { name: "Put Left ventricle on spot 5" }))
      .toBeVisible();

    await page.getByRole("button", { name: "Put Left ventricle on spot 5" }).click();
    await checkActivity();
    await expectVerdict("Not quite");
    await expectCount(page.getByText(HEART_MIX_UP), 2);
  });

  it("process order: sorting the steps with the keyboard is right", async () => {
    openActivity({ template: "processOrder" });
    await sortSteps(PHOTOSYNTHESIS);
    await checkActivity();
    await expectVerdict("Correct!");

    await expect
      .element(page.getByText("The Calvin cycle runs on the ATP and NADPH that light made."))
      .toBeVisible();
  });

  it("process order: steps out of place say where the learner had them", async () => {
    openActivity({ template: "processOrder" });

    await sortSteps([PHOTOSYNTHESIS[0] ?? "", PHOTOSYNTHESIS[1] ?? "", PHOTOSYNTHESIS[3] ?? ""]);

    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("The right order")).toBeVisible();
    await expect.element(page.getByText(/You had it at/u).first()).toBeVisible();
  });

  it("molecule builder: two double bonds make carbon dioxide", async () => {
    openActivity({ template: "moleculeBuilder" });
    await buildCarbonDioxide({ doubleBonds: true });

    await expect
      .element(page.getByText("Every atom has all its bonds.", { exact: true }))
      .toBeVisible();

    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("molecule builder: open bonds are wrong and show a correct build", async () => {
    openActivity({ template: "moleculeBuilder" });
    await buildCarbonDioxide({ doubleBonds: false });
    await expect.element(page.getByText("3 atoms have open bonds, shown as dots.")).toBeVisible();
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("One correct build")).toBeVisible();

    await expect
      .element(page.getByText("4 bonds in all, counting a double bond as two."))
      .toBeVisible();
  });

  it("Punnett square: filling the square answers the share of white flowers", async () => {
    openActivity({ template: "punnettSquare" });
    await fillSquare(["Pp", "Pp", "pp", "pp"]);
    await expect.element(page.getByText("Purple: 2 of 4 · White: 2 of 4")).toBeVisible();
    await page.getByRole("radio", { name: /1 in 2/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("2 of 4 squares: White")).toBeVisible();
  });

  it("Punnett square: a wrong square in a fill-the-square check is wrong", async () => {
    openActivity({ content: FILL_THE_SQUARE, template: "punnettSquare" });

    await fillSquare(["Pp", "pp", "pp", "pp"]);
    await checkActivity();
    await expectVerdict("Not quite");
  });
});

describe("science activities with a keyboard only", () => {
  it("labeled diagram works with the keyboard alone", async () => {
    openActivity({ template: "labeledDiagram" });

    for (const [index, name] of HEART_SPOTS.entries()) {
      // oxlint-disable-next-line no-await-in-loop -- Names are placed one after another.
      await focusOn(page.getByRole("button", { name: `Put ${name} on spot ${index + 1}` }));
      // oxlint-disable-next-line no-await-in-loop -- Enter places the focused name, not the answer.
      await press("Enter");
      // oxlint-disable-next-line no-await-in-loop -- The spot shows the name before the next one.
      await expect
        .element(
          page.getByRole("button", { name: new RegExp(`^Spot ${index + 1}, .*: ${name}$`, "u") }),
        )
        .toBeVisible();
    }

    await focusOn(page.getByRole("button", { name: "Check" }));
    await press("Enter");
    await expectVerdict("Correct!");
  });
});

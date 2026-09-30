import { interactionCheck } from "@zoonk/testing/fixtures/activity-checks";
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

async function labelSpots(page: Page, names: readonly string[]) {
  for (const [index, name] of names.entries()) {
    // oxlint-disable-next-line no-await-in-loop -- Each name goes on the next spot in turn.
    await page
      .getByRole("button", { exact: true, name: `Put ${name} on spot ${index + 1}` })
      .click();
  }
}

async function fillSquare(page: Page, genotypes: readonly string[]) {
  for (const [index, genotype] of genotypes.entries()) {
    // oxlint-disable-next-line no-await-in-loop -- The palette fills one square at a time.
    await page
      .getByRole("button", { exact: true, name: `Put ${genotype} in square ${index + 1}` })
      .click();
  }
}

function moveStatus(page: Page) {
  return page.getByRole("status").filter({ hasText: /is over position|dropped at position/u });
}

/**
 * One arrow press that moves the picked-up step to `position` (counted from 1). The list starts
 * listening for arrows a moment after the pick-up, so a press that didn't move it is repeated,
 * and a press is never repeated once the list says the step moved.
 */
async function arrowTo(
  page: Page,
  { key, position, step }: { key: string; position: number; step: string },
) {
  const moved = `${step} is over position ${position}.`;

  await expect(async () => {
    const status = await moveStatus(page).textContent();

    if (!status?.includes(moved)) {
      await page.keyboard.press(key);
    }

    await expect(moveStatus(page)).toContainText(moved, { timeout: 500 });
  }).toPass();
}

/** Moves a step with the keyboard: Space picks it up, arrows move it, Space drops it. */
async function moveStep(
  page: Page,
  { from, step, to }: { from: number; step: string; to: number },
) {
  const row = page.getByRole("button", { exact: true, name: step });
  const key = to < from ? "ArrowUp" : "ArrowDown";
  const direction = to < from ? -1 : 1;

  await row.focus();
  await row.press("Space");
  await expect(moveStatus(page)).toContainText(`${step} is over position ${from}.`);

  for (const position of Array.from(
    { length: Math.abs(to - from) },
    (_, index) => from + direction * (index + 1),
  )) {
    // oxlint-disable-next-line no-await-in-loop -- Each arrow moves the step one place.
    await arrowTo(page, { key, position, step });
  }

  await page.keyboard.press("Space");
  await expect(moveStatus(page)).toContainText(`${step} dropped at position ${to}.`);
}

async function stepOrder(page: Page): Promise<string[]> {
  const list = page.getByRole("list", { name: "Steps, in your order" });

  return list
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") ?? ""));
}

async function sortSteps(page: Page, expected: readonly string[]) {
  await expect(
    page.getByRole("list", { name: "Steps, in your order" }).getByRole("button"),
  ).toHaveCount(PHOTOSYNTHESIS.length);

  for (const [index, step] of expected.entries()) {
    // oxlint-disable-next-line no-await-in-loop -- Each move depends on the order the last one left.
    const order = await stepOrder(page);
    const current = order.indexOf(step);

    if (current !== index) {
      // oxlint-disable-next-line no-await-in-loop -- Moves happen one after another.
      await moveStep(page, { from: current + 1, step, to: index + 1 });
      // oxlint-disable-next-line no-await-in-loop -- Wait for the drop before the next move.
      await expect
        .poll(async () => {
          const moved = await stepOrder(page);
          return moved[index];
        })
        .toBe(step);
    }
  }
}

async function buildCarbonDioxide(page: Page, { doubleBonds }: { doubleBonds: boolean }) {
  await page.getByRole("button", { name: "Add Carbon" }).click();
  await page.getByRole("button", { name: "Add Oxygen bonded to Carbon 1" }).click();
  await page.getByRole("button", { name: "Add Oxygen bonded to Carbon 1" }).click();

  if (doubleBonds) {
    await page.getByRole("button", { name: "Oxygen 1: 1 of 2 bonds" }).click();
    await page.getByRole("button", { name: "Oxygen 2: 1 of 2 bonds" }).click();
  }
}

for (const mode of MODES) {
  test.describe(`science activities in ${mode} mode`, () => {
    test("parameter simulation: moving the angle to 45° gives the farthest throw", async ({
      page,
    }) => {
      await openActivity(page, { mode, template: "parameterSimulation" });
      await expect(page.getByText("Peak height", { exact: true })).toBeVisible();
      await pressOnSlider(page, "Launch angle", "ArrowRight", 15);
      await expect(valueInput(page)).toHaveValue("40.77");
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("parameter simulation: stopping at another angle is wrong", async ({ page }) => {
      await openActivity(page, { mode, template: "parameterSimulation" });
      await pressOnSlider(page, "Launch angle", "ArrowRight", 5);
      await expect(valueInput(page)).toHaveValue("38.32");
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
    });

    test("labeled diagram: every name on its part is right", async ({ page }) => {
      await openActivity(page, { mode, template: "labeledDiagram" });
      await expect(page.getByText("Low in oxygen")).toBeVisible();
      await labelSpots(page, HEART_SPOTS);
      await expect(page.getByText("Every spot has a name. Tap a spot to change it.")).toBeVisible();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("labeled diagram: a swapped pair shows the writer's mix-up feedback", async ({ page }) => {
      await openActivity(page, { mode, template: "labeledDiagram" });

      await labelSpots(page, [
        "Aorta",
        "Left atrium",
        "Right atrium",
        "Right ventricle",
        "Left ventricle",
      ]);

      await page.getByRole("button", { name: "Spot 5, bottom right: Left ventricle" }).click();

      await expect(
        page.getByRole("button", { name: "Put Left ventricle on spot 5" }),
      ).toBeVisible();

      await page.getByRole("button", { name: "Put Left ventricle on spot 5" }).click();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText(HEART_MIX_UP)).toHaveCount(2);
    });

    test("process order: sorting the steps with the keyboard is right", async ({ page }) => {
      await openActivity(page, { mode, template: "processOrder" });
      await sortSteps(page, PHOTOSYNTHESIS);
      await checkActivity(page);
      await expectVerdict(page, "Correct!");

      await expect(
        page.getByText("The Calvin cycle runs on the ATP and NADPH that light made."),
      ).toBeVisible();
    });

    test("process order: steps out of place say where the learner had them", async ({ page }) => {
      await openActivity(page, { mode, template: "processOrder" });

      await sortSteps(page, [
        PHOTOSYNTHESIS[0] ?? "",
        PHOTOSYNTHESIS[1] ?? "",
        PHOTOSYNTHESIS[3] ?? "",
      ]);

      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("The right order")).toBeVisible();
      await expect(page.getByText(/You had it at/u).first()).toBeVisible();
    });

    test("molecule builder: two double bonds make carbon dioxide", async ({ page }) => {
      await openActivity(page, { mode, template: "moleculeBuilder" });
      await buildCarbonDioxide(page, { doubleBonds: true });
      await expect(page.getByText("Every atom has all its bonds.", { exact: true })).toBeVisible();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("molecule builder: open bonds are wrong and show a correct build", async ({ page }) => {
      await openActivity(page, { mode, template: "moleculeBuilder" });
      await buildCarbonDioxide(page, { doubleBonds: false });
      await expect(page.getByText("3 atoms have open bonds, shown as dots.")).toBeVisible();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("One correct build")).toBeVisible();
      await expect(page.getByText("4 bonds in all, counting a double bond as two.")).toBeVisible();
    });

    test("Punnett square: filling the square answers the share of white flowers", async ({
      page,
    }) => {
      await openActivity(page, { mode, template: "punnettSquare" });
      await fillSquare(page, ["Pp", "Pp", "pp", "pp"]);
      await expect(page.getByText("Purple: 2 of 4 · White: 2 of 4")).toBeVisible();
      await page.getByRole("radio", { name: /1 in 2/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("2 of 4 squares: White")).toBeVisible();
    });

    test("Punnett square: a wrong square in a fill-the-square check is wrong", async ({ page }) => {
      await openActivity(page, { content: FILL_THE_SQUARE, mode, template: "punnettSquare" });

      await fillSquare(page, ["Pp", "pp", "pp", "pp"]);
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
    });
  });
}

test("labeled diagram works with the keyboard alone", async ({ page }) => {
  await openActivity(page, { mode: "focus", template: "labeledDiagram" });

  for (const [index, name] of HEART_SPOTS.entries()) {
    const chip = page.getByRole("button", { name: `Put ${name} on spot ${index + 1}` });
    // oxlint-disable-next-line no-await-in-loop -- Names are placed one after another.
    await chip.focus();
    // oxlint-disable-next-line no-await-in-loop -- Enter places the focused name, not the answer.
    await page.keyboard.press("Enter");
    // oxlint-disable-next-line no-await-in-loop -- The spot shows the name before the next one.
    await expect(
      page.getByRole("button", { name: new RegExp(`^Spot ${index + 1}, .*: ${name}$`, "u") }),
    ).toBeVisible();
  }

  await page.getByRole("button", { name: "Check" }).focus();
  await page.keyboard.press("Enter");
  await expectVerdict(page, "Correct!");
});

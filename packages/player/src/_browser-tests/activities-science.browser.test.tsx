import { interactionCheck } from "@zoonk/testing/fixtures/activity-checks";
import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
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
import { atViewport } from "../_test-utils/browser-viewport";

const FILL_THE_SQUARE = { ...activityContentFixtures.combinationGrid, check: interactionCheck };

const HEART_MIX_UP = "The picture faces you, so the heart's right side is on your left.";

const HEART_SPOTS = ["Right atrium", "Left atrium", "Right ventricle", "Left ventricle", "Aorta"];

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

function cellOption(value: string) {
  const isGenotype = /^[A-Za-z]+$/u.test(value);

  return page
    .getByRole("group", { name: "What goes in the highlighted square?" })
    .getByRole("button", { name: new RegExp(isGenotype ? `^${value}` : `^${value}$`, "u") });
}

async function fillSquare(values: readonly string[]) {
  for (const value of values) {
    // oxlint-disable-next-line no-await-in-loop -- The palette fills one square at a time.
    await cellOption(value).click();
  }
}

function moveStatus() {
  return page.getByRole("status").filter({ hasText: /is over position|dropped at position/u });
}

function stepText(button: Element): string {
  const words = button.cloneNode(true);

  if (!(words instanceof Element)) {
    return "";
  }

  for (const hidden of words.querySelectorAll("[aria-hidden='true']")) {
    hidden.remove();
  }

  return words.textContent.trim();
}

function stepOrder(): string[] {
  return page
    .getByRole("list", { name: "Steps, in your order" })
    .getByRole("button")
    .elements()
    .map((button) => stepText(button));
}

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
  it("formula model simulation: moving the angle to 45° gives the farthest throw", async () => {
    openActivity({ content: engineModeFixtures.formulaModel.simulation, template: "formulaModel" });
    await expect.element(page.getByText("Projectile", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Peak height", { exact: true })).toBeVisible();
    await pressOnSlider("Launch angle", "ArrowRight", 15);
    await expect.element(valueInput()).toHaveValue("40.77");
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("formula model simulation: stopping at another angle is wrong", async () => {
    openActivity({ content: engineModeFixtures.formulaModel.simulation, template: "formulaModel" });
    await pressOnSlider("Launch angle", "ArrowRight", 5);
    await expect.element(valueInput()).toHaveValue("38.32");
    await checkActivity();
    await expectVerdict("Not quite");

    await expect
      .poll(() =>
        document
          .querySelector("[data-slot='activity-plot']")
          ?.textContent.replaceAll("\u00A0", " "),
      )
      .toContain("41 m");
  });

  it("formula model simulation: the chart and feedback follow the hint after a slider miss", async () => {
    const simulation = engineModeFixtures.formulaModel.simulation;

    openActivity({
      content: {
        ...simulation,
        check: {
          ...simulation.check,
          answer: 40.7747,
          explanation: simulation.check.explanation.replace("40.77", "40.775"),
        },
      },
      template: "formulaModel",
    });

    await pressOnSlider("Launch angle", "ArrowRight", 14);
    await expect.element(valueInput()).toHaveValue("40.75");
    await checkActivity();
    await expectVerdict("Not quite");
    const feedback = page.getByRole("region", { name: "Answer feedback" });
    await expect.element(feedback.getByText("41 m", { exact: true })).toBeVisible();

    expect(feedback.getByText(/farther than at any other angle/u).element().textContent).toContain(
      "40.775",
    );

    await expect
      .poll(() =>
        [...document.querySelectorAll("[data-slot='activity-plot'] text")].map((text) =>
          text.textContent.replaceAll("\u00A0", " "),
        ),
      )
      .toContain("41 m");
  });

  it("formula model simulation: a near miss stays distinct from the chart's right answer", async () => {
    const simulation = engineModeFixtures.formulaModel.simulation;

    openActivity({
      content: {
        ...simulation,
        check: {
          ...simulation.check,
          answer: 40.7747,
          explanation: simulation.check.explanation.replace("40.77", "40.7747"),
        },
      },
      template: "formulaModel",
    });

    await valueInput().fill("40.7849");
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(valueInput()).toHaveValue("40.785");
    const feedback = page.getByRole("region", { name: "Answer feedback" });
    await expect.element(feedback.getByText("41 m", { exact: true })).toBeVisible();

    await expect
      .poll(() =>
        [...document.querySelectorAll("[data-slot='activity-plot'] text")].map((text) =>
          text.textContent.replaceAll("\u00A0", " "),
        ),
      )
      .toContain("41 m");
  });

  it("labeled diagram: every name on its part is right", async () => {
    openActivity({ template: "labeledDiagram" });
    await expect.element(page.getByRole("img", { name: /five numbered spots/u })).toBeVisible();
    await labelSpots(HEART_SPOTS);

    await expect
      .element(page.getByText("Every spot has a name. Pick a spot to change it."))
      .toBeVisible();

    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("labeled diagram: a swapped pair shows the writer's mix-up feedback", async () => {
    openActivity({ template: "labeledDiagram" });

    await labelSpots(["Left atrium", "Right atrium", "Right ventricle", "Left ventricle", "Aorta"]);

    await page.getByRole("button", { name: "Spot 5: Aorta" }).click();
    await expect.element(page.getByRole("button", { name: "Put Aorta on spot 5" })).toBeVisible();
    await page.getByRole("button", { name: "Put Aorta on spot 5" }).click();
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

  it("molecule builder: the first atom keeps the build status in place", async () => {
    openActivity({ template: "moleculeBuilder" });
    const card = page.getByRole("figure");

    const statusTop = (text: string) =>
      page.getByText(text, { exact: true }).element().getBoundingClientRect().top -
      card.element().getBoundingClientRect().top;

    const initialStatus = "Pick an element to add its first atom.";
    await expect.element(page.getByText(initialStatus, { exact: true })).toBeVisible();
    const top = statusTop(initialStatus);

    await page.getByRole("button", { name: "Add Carbon" }).click();
    await expect.element(page.getByText("Built: C", { exact: true })).toBeVisible();
    expect(statusTop("1 atom has open bonds, shown as dots.")).toBe(top);
  });

  it("molecule builder: selecting an atom keeps the tools in place on a phone", async () => {
    await atViewport({ height: 844, width: 320 }, async () => {
      openActivity({ template: "moleculeBuilder" });
      const card = page.getByRole("figure");
      const undo = page.getByRole("button", { exact: true, name: "Undo" });
      const addCarbon = page.getByRole("button", { name: /^Add Carbon/u });
      const atom = page.getByRole("button", { name: "Carbon 1: 0 of 4 bonds" });

      const toolsTop = () =>
        undo.element().getBoundingClientRect().top - card.element().getBoundingClientRect().top;

      await expect.element(undo).toBeVisible();
      const beforeAdding = toolsTop();
      await addCarbon.click();
      await expect.element(atom).toHaveAttribute("aria-pressed", "true");

      await atom.click();
      await expect.element(atom).toHaveAttribute("aria-pressed", "false");
      const beforeSelecting = toolsTop();

      await atom.click();
      await expect.element(atom).toHaveAttribute("aria-pressed", "true");
      expect(toolsTop()).toBe(beforeSelecting);
      expect(toolsTop()).toBe(beforeAdding);
    });
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

  it("Punnett grid: filling the square answers the share of white flowers", async () => {
    openActivity({ template: "combinationGrid" });
    await fillSquare(["Pp", "Pp", "pp", "pp"]);
    await expect.element(page.getByText("Purple: 2 of 4 · White: 2 of 4")).toBeVisible();
    await page.getByRole("radio", { name: /1 in 2/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("White: 2 of 4 squares")).toBeVisible();
  });

  it("Punnett grid: the share is asked once the square is filled, one question at a time", async () => {
    openActivity({ template: "combinationGrid" });
    const share = page.getByText("What share of the seeds grow white flowers?");

    await expect
      .element(page.getByRole("group", { name: "What goes in the highlighted square?" }))
      .toBeVisible();

    await expect.element(share).not.toBeInTheDocument();

    await fillSquare(["Pp", "Pp", "pp", "pp"]);
    await expect.element(share).toBeVisible();
  });

  it("Punnett grid: number keys fill a square picked to change, not the share question", async () => {
    openActivity({ template: "combinationGrid" });
    await fillSquare(["Pp", "Pp", "pp", "pp"]);

    await expect
      .element(page.getByText("What share of the seeds grow white flowers?"))
      .toBeVisible();

    const square = page.getByRole("button", { name: /^Square 1,/u });
    const before = square.element().textContent;
    await square.click();

    const choiceKeys = [
      ...document.querySelectorAll('[data-slot="player-choice-scene-options"] [data-slot="kbd"]'),
    ];

    expect(choiceKeys.length).toBeGreaterThan(0);
    expect(choiceKeys.map((key) => getComputedStyle(key).visibility)).not.toContain("visible");

    expect(
      page
        .getByRole("radio")
        .elements()
        .map((radio) => radio.getAttribute("aria-keyshortcuts")),
    ).toStrictEqual(
      page
        .getByRole("radio")
        .elements()
        .map(() => null),
    );

    await userEvent.keyboard("1");

    await expect.element(page.getByRole("radio", { checked: true })).not.toBeInTheDocument();
    await expect.poll(() => square.element().textContent).not.toBe(before);
  });

  it("Punnett grid: a wrong square in a fill-the-square check is wrong", async () => {
    openActivity({ content: FILL_THE_SQUARE, template: "combinationGrid" });

    await fillSquare(["Pp", "pp", "pp", "pp"]);
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("3 of 4 squares right", { exact: true })).toBeVisible();
  });

  it("times table grid: filling every product is right", async () => {
    openActivity({
      content: engineModeFixtures.combinationGrid.timesTable,
      template: "combinationGrid",
    });

    await fillSquare(["2", "4", "6", "3", "6", "9", "4", "8", "12"]);
    await expect.element(page.getByText("9 of 9 squares filled")).toBeVisible();
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("two dice grid: shown filled to read, then the sevens are counted", async () => {
    openActivity({ content: engineModeFixtures.combinationGrid.dice, template: "combinationGrid" });

    await expect
      .element(page.getByRole("group", { name: /goes in the highlighted square/u }))
      .not.toBeInTheDocument();

    await valueInput().fill("0.1667");
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("7: 6 of 36 squares")).toBeVisible();
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
        .element(page.getByRole("button", { name: `Spot ${index + 1}: ${name}` }))
        .toBeVisible();
    }

    await focusOn(page.getByRole("button", { name: "Check" }));
    await press("Enter");
    await expectVerdict("Correct!");
  });
});

describe("numeric answer guidance", () => {
  it("numeric checks say how many decimal places the dice answer needs", async () => {
    openActivity({ content: engineModeFixtures.combinationGrid.dice, template: "combinationGrid" });
    await expect.element(page.getByText("Round to 2 decimal places.")).toBeVisible();
    await valueInput().fill("0.17");
    await checkActivity();
    await expectVerdict("Correct!");
  });
});

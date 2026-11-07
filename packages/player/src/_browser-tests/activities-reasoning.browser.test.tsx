import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { type Locator, page } from "vitest/browser";
import {
  checkActivity,
  expectCount,
  expectMathVisible,
  expectSideBySide,
  expectVerdict,
  focusOn,
  openActivity,
  press,
  pressOnPage,
  sortCard,
  sortedCard,
} from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { activityStep } from "../preview/preview-steps";

const NUMBERED_BEAKERS = {
  alt: "Two beakers side by side, numbered 1 and 2",
  parts: ["left beaker", "right beaker"],
  prompt: "Two beakers on a lab bench",
};

async function expectHeard(text: string) {
  await expect.element(page.getByText(text, { exact: true })).toBeInTheDocument();
}

async function matchCards(left: string, right: string) {
  await page.getByRole("button", { exact: true, name: left }).click();
  await page.getByRole("button", { exact: true, name: right }).click();
}

async function expectAloneInItsRow(card: Locator) {
  await expect
    .poll(() => {
      const top = card.element().getBoundingClientRect().top;

      return page
        .getByRole("group", { name: "Cards to match" })
        .getByRole("button")
        .elements()
        .filter((other) => other !== card.element() && other.getBoundingClientRect().top === top)
        .map((other) => other.getAttribute("aria-label"));
    })
    .toStrictEqual([]);
}

describe("reasoning activities", () => {
  it("categorize: a long sorted card keeps the groups under the learner's thumb", async () => {
    await atViewport({ height: 844, width: 390 }, async () => {
      const fixture = activityContentFixtures.categorize;

      const text =
        "Melting ice in a bowl on a warm kitchen counter changes the shape of the water without making a new substance";

      openActivity({
        content: {
          ...fixture,
          fields: {
            ...fixture.fields,
            groups: fixture.fields.groups.toReversed(),
            items: fixture.fields.items.map((item) =>
              item.id === "i2" ? { ...item, text } : item,
            ),
          },
        },
        template: "categorize",
      });

      const group = page.getByRole("button", { name: "Same substance" });
      await expect.element(group).toBeVisible();

      const height = group.element().getBoundingClientRect().height;
      const nextGroup = page.getByRole("button", { name: "New substance" });
      const nextTop = nextGroup.element().getBoundingClientRect().top;

      await sortCard({ group: "Same substance", item: text });

      expect(group.element().getBoundingClientRect().height).toBe(height);
      expect(nextGroup.element().getBoundingClientRect().top).toBe(nextTop);
    });
  });

  it("categorize: a card name that fits stays readable beside the count", async () => {
    await atViewport({ height: 844, width: 390 }, async () => {
      const fixture = activityContentFixtures.categorize;
      const text = "Warming a metal spoon in hot tea";

      openActivity({
        content: {
          ...fixture,
          fields: {
            ...fixture.fields,
            items: fixture.fields.items.map((item) =>
              item.id === "i3"
                ? { ...item, groupId: "physical", text, why: "It is still metal." }
                : item,
            ),
          },
        },
        template: "categorize",
      });

      await sortCard({ group: "Same substance", item: "Melting ice" });
      await sortCard({ group: "Same substance", item: text });

      const group = page.getByRole("button", { name: "Same substance" });
      await expect.element(group.getByText("+1", { exact: true })).toBeVisible();

      const preview = group.element().querySelector('[data-slot="categorize-preview"]');
      const chip = preview?.firstElementChild;

      if (!chip) {
        throw new Error("The sorted group must show its latest card.");
      }

      expect(chip.scrollWidth).toBeLessThanOrEqual(chip.clientWidth);
    });
  });

  it("categorize: every item in its group is right", async () => {
    openActivity({ template: "categorize" });
    await expect.element(page.getByText("0 of 3 sorted", { exact: true })).toBeVisible();
    await sortCard({ group: "Same substance", item: "Melting ice" });
    await sortCard({ group: "New substance", item: "Rusting iron" });
    await sortCard({ group: "New substance", item: "Burning wood" });
    await expect.element(page.getByText("All sorted. Choose a card to move it.")).toBeVisible();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("3 of 3 in the right group")).toBeVisible();
  });

  it("categorize: sorting shows no data, so it never says its numbers are examples", async () => {
    openActivity({
      content: { ...activityContentFixtures.categorize, data: { isExample: true } },
      template: "categorize",
    });

    await expect.element(page.getByText("0 of 3 sorted", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Example numbers, not real data")).not.toBeInTheDocument();
  });

  it("categorize: a tap on a card already in a group sorts the next card into it", async () => {
    openActivity({ template: "categorize" });
    await sortCard({ group: "Same substance", item: "Melting ice" });
    const sameSubstance = page.getByRole("button", { name: "Same substance" });

    await sameSubstance.getByText("Melting ice").click();
    await expect.element(page.getByText("2 of 3 sorted", { exact: true })).toBeVisible();
    await expect.element(sameSubstance.getByText("Rusting iron", { exact: true })).toBeVisible();
    await expect.element(sameSubstance.getByText("+1", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Burning wood", { exact: true })).toBeVisible();
  });

  it("categorize: Undo takes back the last card", async () => {
    openActivity({ template: "categorize" });
    await sortCard({ group: "Same substance", item: "Melting ice" });
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.element(page.getByText("0 of 3 sorted", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Melting ice", { exact: true })).toBeVisible();
  });

  it("categorize: a sorted card moves to another group from its menu", async () => {
    openActivity({ template: "categorize" });
    await sortCard({ group: "Same substance", item: "Melting ice" });
    await sortCard({ group: "Same substance", item: "Rusting iron" });
    await sortCard({ group: "New substance", item: "Burning wood" });
    await sortedCard({ group: "Same substance", item: "Rusting iron" }).click();
    await page.getByRole("menuitem", { name: "New substance" }).click();

    await expect
      .element(sortedCard({ group: "New substance", item: "Rusting iron" }))
      .toBeVisible();

    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("categorize: a misplaced item says where it belongs and why", async () => {
    openActivity({ template: "categorize" });
    await sortCard({ group: "Same substance", item: "Melting ice" });
    await sortCard({ group: "New substance", item: "Rusting iron" });
    await sortCard({ group: "Same substance", item: "Burning wood" });
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("Burning wood belongs in New substance.")).toBeVisible();
    await expect.element(page.getByText("Ash and gas form.")).toBeVisible();
  });

  it("categorize: math cards and groups are heard in words and drawn as math, never LaTeX", async () => {
    openActivity({
      content: {
        ...activityContentFixtures.categorize,
        fields: {
          groups: [
            { id: "half", label: String.raw`Equals $\frac{1}{2}$`, rule: "Half of one." },
            { id: "two", label: "Equals $2$", rule: "Twice one." },
          ],
          items: [
            { groupId: "half", id: "i1", text: String.raw`$\frac{2}{4}$`, why: "Two of four." },
            { groupId: "two", id: "i2", text: String.raw`$\sqrt{4}$`, why: "Two times two." },
            { groupId: "two", id: "i3", text: String.raw`$\frac{4}{2}$`, why: "Four split." },
          ],
        },
        prompt: "Sort each expression by its value.",
      },
      template: "categorize",
    });

    await expectHeard("Sort 3 cards into Equals 1 over 2, Equals 2, one at a time.");

    await pressOnPage("1");
    await expectHeard("square root of 4 is in Equals 1 over 2. Next: 4 over 2.");
    await page.getByRole("button", { name: "Undo" }).click();
    await expectHeard("Took back square root of 4.");
    await pressOnPage("1");
    await pressOnPage("2");
    await pressOnPage("2");
    await expectHeard("2 over 4 is in Equals 2.");
    const firstGroup = page.getByRole("region", { name: /^Equals/u }).first();
    await firstGroup.getByRole("button").click();
    await page.getByRole("menuitem").click();
    await expectHeard("square root of 4 is in Equals 2.");
    await checkActivity();
    await expectVerdict("Not quite");

    const reason = page.getByRole("listitem").filter({ hasText: /belongs in/u });

    const formulas = reason.getByRole("math");

    await expectCount(formulas, 2);
    await expectMathVisible(formulas.first());
    await expectMathVisible(formulas.last());
    await expect.element(reason).not.toMatchTextContent("$");
  });

  it("match pairs: matching each pair on the first try is right", async () => {
    openActivity({ template: "matchPairs" });
    await matchCards("embarazada", "pregnant");
    await matchCards("éxito", "success");
    await matchCards("librería", "bookstore");

    await expect
      .element(page.getByText("3 of 3 pairs matched · 2 cards have no match", { exact: true }))
      .toBeVisible();

    await expect
      .element(page.getByRole("button", { name: "embarrassed, no match" }))
      .toBeDisabled();

    await expect.element(page.getByRole("button", { name: "library, no match" })).toBeDisabled();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("Look-alikes with no match")).toBeVisible();
  });

  it("match pairs: puts each card beside its match and each look-alike in a row of its own once every pair is matched", async () => {
    openActivity({ template: "matchPairs" });
    const pairs = activityContentFixtures.matchPairs.fields.pairs;

    for (const { left, right } of pairs) {
      // oxlint-disable-next-line no-await-in-loop -- A pair is matched by tapping its sides in turn.
      await matchCards(left, right);
    }

    for (const { left, right } of pairs) {
      // oxlint-disable-next-line no-await-in-loop -- Each pair is checked once the board settles.
      await expectSideBySide(
        page.getByRole("button", { name: `${left}, matched` }),
        page.getByRole("button", { name: `${right}, matched` }),
      );
    }

    await expectAloneInItsRow(page.getByRole("button", { name: "embarrassed, no match" }));
    await expectAloneInItsRow(page.getByRole("button", { name: "library, no match" }));
  });

  it("match pairs: a trap explains itself, stays marked and the first try counts", async () => {
    openActivity({ template: "matchPairs" });
    await matchCards("embarazada", "embarrassed");

    await expect
      .element(
        page.getByText(
          "“embarrassed” has no match. Embarrassed is avergonzada in Spanish. Embarazada looks like it but means pregnant.",
          { exact: true },
        ),
      )
      .toBeVisible();

    await expect
      .element(page.getByRole("button", { name: "embarrassed, no match" }))
      .toBeDisabled();

    await expect.element(page.getByRole("button", { name: "Check" })).toBeDisabled();
    await matchCards("embarazada", "pregnant");
    await matchCards("éxito", "success");
    await matchCards("librería", "bookstore");
    await checkActivity();
    await expectVerdict("Not quite");

    await expect
      .element(page.getByText("embarazada goes with pregnant, not embarrassed."))
      .toBeVisible();
  });

  it("match pairs: a screen reader hears math cards in words, not LaTeX", async () => {
    openActivity({
      content: {
        ...activityContentFixtures.matchPairs,
        fields: {
          distractors: [
            {
              side: "right",
              text: "1.2",
              why: String.raw`$\frac{1}{2}$ is one divided by two, not the digits 1 and 2.`,
            },
          ],
          pairs: [
            { id: "half", left: String.raw`$\frac{1}{2}$`, right: "0.5" },
            { id: "square", left: "$3^2$", right: "9" },
          ],
        },
        prompt: "Match each expression to its value.",
      },
      template: "matchPairs",
    });

    await matchCards("1 over 2", "1.2");

    await expect
      .element(
        page.getByText(
          "1 over 2 and 1.2 don't go together. “1.2” has no match. 1 over 2 is one divided by two, not the digits 1 and 2.",
          { exact: true },
        ),
      )
      .toBeInTheDocument();

    await matchCards("1 over 2", "0.5");

    await expect
      .element(page.getByText("Matched 1 over 2 with 0.5. 1 of 2 pairs matched.", { exact: true }))
      .toBeInTheDocument();

    await expect.element(page.getByRole("button", { name: "1 over 2, matched" })).toBeDisabled();
    await expect.element(page.getByRole("button", { name: "3 squared" })).toBeEnabled();
  });

  it("argument builder: the strong quote and reasoning are right", async () => {
    openActivity({ template: "argumentBuilder" });
    await page.getByRole("button", { name: /Use as evidence: It is too rash/u }).click();
    await page.getByRole("button", { name: /Use as reasoning: Juliet herself/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("It names the speed.")).toBeVisible();
  });

  it("argument builder: a weak quote names the stronger one", async () => {
    openActivity({ template: "argumentBuilder" });
    await page.getByRole("button", { name: /Use as evidence: O brawling love/u }).click();
    await page.getByRole("button", { name: "Take the quote out" }).click();
    await page.getByRole("button", { name: /Use as evidence: O brawling love/u }).click();
    await page.getByRole("button", { name: /Use as reasoning: Juliet herself/u }).click();
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("Stronger evidence")).toBeVisible();
    await expect.element(page.getByText("It is about Rosaline.")).toBeVisible();
  });

  it("find the error: tapping the wrong step shows its fix", async () => {
    openActivity({ template: "findError" });
    await page.getByRole("radio", { name: /Step 2: Down 20%/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("120 × 0.8 = 96, not 100.")).toBeVisible();
  });

  it("find the error: another step points to the wrong one", async () => {
    openActivity({ template: "findError" });
    await page.getByRole("radio", { name: /Step 3: So the price/u }).click();
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("The wrong step is step 2.")).toBeVisible();
  });

  it("spot the AI's mistake: the answer is labeled as an AI assistant's", async () => {
    const fixture = activityContentFixtures.findError;
    const content = { ...fixture, fields: { ...fixture.fields, author: "ai" } };

    openActivity({ content, template: "findError" });

    await expect.element(page.getByText("Someone asked an AI assistant")).toBeVisible();

    await expect
      .element(page.getByRole("list", { name: "The AI assistant's answer" }))
      .toBeVisible();

    await page.getByRole("radio", { name: /Step 2: Down 20%/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("spot the AI's mistake: the problem's data reads as a table, not a line of pipes", async () => {
    const fixture = activityContentFixtures.findError;

    const problem = [
      "Sabrina asked the AI: how many distinct requests are in this log?",
      "",
      "| request | event | action |",
      "|---|---|---|",
      "| 801 | E11 | opened |",
      "| 801 | E12 | assigned |",
      "| 802 | E13 | opened |",
    ].join("\n");

    openActivity({
      content: { ...fixture, fields: { ...fixture.fields, author: "ai", problem } },
      template: "findError",
    });

    const table = page.getByRole("table");

    await expect.element(table.getByRole("columnheader", { name: "request" })).toBeVisible();
    await expect.element(table.getByRole("cell", { name: "E12" })).toBeVisible();
    await expect.element(page.getByText("how many distinct requests")).toBeVisible();
    await expect.element(page.getByText("|---|", { exact: false })).not.toBeInTheDocument();
  });
});

describe("reasoning activities with only a keyboard", () => {
  it("categorize: number keys sort nothing while its numbered picture is drawn", async () => {
    const step = activityStep({
      content: { ...activityContentFixtures.categorize, image: NUMBERED_BEAKERS },
      image: null,
      imagePending: true,
    });

    renderLessonPlayer({ lesson: buildLesson([step]) });
    await expect.element(page.getByText("Drawing the picture…")).toBeVisible();
    await expect.element(page.getByText("0 of 3 sorted", { exact: true })).toBeVisible();
    await pressOnPage("1");
    await expect.element(page.getByText("1 of 3 sorted", { exact: true })).not.toBeInTheDocument();
    await expect.element(page.getByText("0 of 3 sorted", { exact: true })).toBeVisible();
  });

  it("categorize: sorting the last card while Undo has focus moves focus to the status", async () => {
    openActivity({ template: "categorize" });
    await sortCard({ group: "Same substance", item: "Melting ice" });
    await sortCard({ group: "New substance", item: "Rusting iron" });
    await focusOn(page.getByRole("button", { name: "Undo" }));
    await press("Enter");
    await expect.element(page.getByRole("button", { name: "Undo" })).toHaveFocus();
    await press("1");
    await press("1");
    await expect.element(page.getByText("All sorted. Choose a card to move it.")).toHaveFocus();
  });

  it("categorize: number keys sort each card in turn, then Enter checks", async () => {
    openActivity({ template: "categorize" });
    await focusOn(page.getByRole("button", { name: "New substance" }));
    await press("2");
    await press("1");
    await press("1");
    await expect.element(page.getByText("All sorted. Choose a card to move it.")).toHaveFocus();
    await press("Enter");
    await expectVerdict("Correct!");
  });

  it("categorize: Escape closes a card's menu and stays on the activity", async () => {
    const { onExit } = openActivity({ template: "categorize" });
    await expect.element(page.getByText("0 of 3 sorted", { exact: true })).toBeVisible();
    await pressOnPage("2");
    await press("1");
    await press("1");
    await focusOn(sortedCard({ group: "Same substance", item: "Melting ice" }));
    await press("Enter");

    const moveToNew = page.getByRole("menuitem", { name: "New substance" });
    await expect.element(moveToNew).toBeVisible();
    await press("Escape");
    await expect.element(moveToNew).not.toBeInTheDocument();

    await expect
      .element(sortedCard({ group: "Same substance", item: "Melting ice" }))
      .toBeVisible();

    expect(onExit).not.toHaveBeenCalled();
  });
});

import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import {
  checkActivity,
  expectCount,
  expectVerdict,
  focusOn,
  inlineImage,
  openActivity,
  press,
} from "../_test-utils/activity-player";

/** The picture a decision tree's case asks for: the tree to name from one leaf. */
const LEAF = {
  alt: "A long, thin needle growing in a bundle of two from the twig",
  prompt: "Two long pine needles joined at the base on a twig",
};

async function sortItem({ group, item }: { group: string; item: string }) {
  await page.getByRole("button", { exact: true, name: item }).click();
  await page.getByRole("button", { name: `Put ${item} in ${group}` }).click();
}

async function matchCards(left: string, right: string) {
  await page.getByRole("button", { exact: true, name: left }).click();
  await page.getByRole("button", { exact: true, name: right }).click();
}

describe("reasoning activities", () => {
  it("categorize: every item in its group is right", async () => {
    openActivity({ template: "categorize" });
    await expect.element(page.getByText("0 of 3 sorted", { exact: true })).toBeVisible();
    await sortItem({ group: "New substance", item: "Burning wood" });
    await sortItem({ group: "Same substance", item: "Melting ice" });
    await sortItem({ group: "New substance", item: "Rusting iron" });
    await expect.element(page.getByText("All sorted. Check when you're ready.")).toBeVisible();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("3 of 3 in the right group")).toBeVisible();
  });

  it("categorize: a misplaced item says where it belongs and why", async () => {
    openActivity({ mode: "fun", template: "categorize" });
    await sortItem({ group: "Same substance", item: "Burning wood" });
    await sortItem({ group: "Same substance", item: "Melting ice" });
    await sortItem({ group: "New substance", item: "Rusting iron" });
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("Burning wood belongs in New substance.")).toBeVisible();
    await expect.element(page.getByText("Ash and gas form.")).toBeVisible();
  });

  it("match pairs: matching each pair on the first try is right", async () => {
    openActivity({ mode: "fun", template: "matchPairs" });
    await matchCards("embarazada", "pregnant");
    await matchCards("éxito", "success");
    await expect.element(page.getByText("2 of 2 pairs matched", { exact: true })).toBeVisible();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("Look-alikes with no match")).toBeVisible();
  });

  it("match pairs: a trap explains itself and the first try counts", async () => {
    openActivity({ template: "matchPairs" });
    await matchCards("embarazada", "embarrassed");

    await expect
      .element(page.getByText("It looks alike but means something else.", { exact: true }))
      .toBeVisible();

    await expect.element(page.getByRole("button", { name: "Check" })).toBeDisabled();
    await matchCards("embarazada", "pregnant");
    await matchCards("éxito", "success");
    await checkActivity();
    await expectVerdict("Not quite");

    await expect
      .element(page.getByText("embarazada goes with pregnant, not embarrassed."))
      .toBeVisible();
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
    openActivity({ mode: "fun", template: "argumentBuilder" });
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
    openActivity({ mode: "fun", template: "findError" });
    await page.getByRole("button", { name: /Step 2: Down 20%/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("120 × 0.8 = 96, not 100.")).toBeVisible();
  });

  it("find the error: another step points to the wrong one", async () => {
    openActivity({ template: "findError" });
    await page.getByRole("button", { name: /Step 3: So the price/u }).click();
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

    await page.getByRole("button", { name: /Step 2: Down 20%/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");
  });

  it("decision tree: following the case reaches its outcome", async () => {
    openActivity({ mode: "fun", template: "decisionTree" });

    await expect
      .element(page.getByRole("list", { name: "Still possible" }))
      .toMatchTextContent("Oak");

    await page.getByRole("button", { name: "Needles" }).click();

    await expect
      .element(page.getByRole("list", { name: "Still possible" }))
      .not.toMatchTextContent("Oak");

    await page.getByRole("button", { name: "In bundles" }).click();
    await expect.element(page.getByText("The key leads to")).toBeVisible();
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("It leads to Pine.")).toBeVisible();
  });

  it("decision tree: the case comes with its picture, or its description until drawn", async () => {
    const content = { ...activityContentFixtures.decisionTree, image: LEAF };

    const drawn = openActivity({
      content,
      image: inlineImage({ alt: LEAF.alt }),
      mode: "fun",
      template: "decisionTree",
    });

    await expect.element(page.getByRole("img", { name: LEAF.alt })).toBeVisible();
    drawn.unmount();

    openActivity({ content, mode: "fun", template: "decisionTree" });
    await expect.element(page.getByText(LEAF.alt)).toBeVisible();
    await expectCount(page.getByRole("img", { name: LEAF.alt }), 0);
  });

  it("decision tree: undo steps back, and a wrong branch is shown", async () => {
    openActivity({ template: "decisionTree" });
    await page.getByRole("button", { name: "Broad leaves" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    await page.getByRole("button", { name: "Needles" }).click();
    await page.getByRole("button", { name: "Single" }).click();
    await checkActivity();
    await expectVerdict("Not quite");
    await expect.element(page.getByText("You chose Single")).toBeVisible();
  });
});

describe("reasoning activities with only a keyboard", () => {
  it("categorize: Space picks an item and its group, then Check", async () => {
    openActivity({ template: "categorize" });

    const placements = [
      ["Burning wood", "New substance"],
      ["Melting ice", "Same substance"],
      ["Rusting iron", "New substance"],
    ] as const;

    for (const [item, group] of placements) {
      // oxlint-disable-next-line no-await-in-loop -- Each item is sorted in turn.
      await focusOn(page.getByRole("button", { exact: true, name: item }));
      // oxlint-disable-next-line no-await-in-loop -- Each item is sorted in turn.
      await press("Space");
      // oxlint-disable-next-line no-await-in-loop -- Each item is sorted in turn.
      await focusOn(page.getByRole("button", { name: `Put ${item} in ${group}` }));
      // oxlint-disable-next-line no-await-in-loop -- Each item is sorted in turn.
      await press("Space");
    }

    await focusOn(page.getByRole("button", { name: "Check" }));
    await press("Enter");
    await expectVerdict("Correct!");
  });
});

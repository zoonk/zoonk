import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { mediaAssetFixture } from "@zoonk/testing/fixtures/library-steps";
import { checkActivity, expectVerdict, openActivity } from "./activity-lesson";
import { type Page, expect, test } from "./fixtures";
import { MODES } from "./learn-personas";

/** The picture a decision tree's case asks for: the tree to name from one leaf. */
const LEAF = {
  alt: "A long, thin needle growing in a bundle of two from the twig",
  prompt: "Two long pine needles joined at the base on a twig",
};

async function sortItem(page: Page, { group, item }: { group: string; item: string }) {
  await page.getByRole("button", { exact: true, name: item }).click();
  await page.getByRole("button", { name: `Put ${item} in ${group}` }).click();
}

async function matchCards(page: Page, left: string, right: string) {
  await page.getByRole("button", { exact: true, name: left }).click();
  await page.getByRole("button", { exact: true, name: right }).click();
}

for (const mode of MODES) {
  test.describe(`reasoning activities in ${mode} mode`, () => {
    test("categorize: every item in its group is right", async ({ page }) => {
      await openActivity(page, { mode, template: "categorize" });
      await expect(page.getByText("0 of 3 sorted", { exact: true })).toBeVisible();
      await sortItem(page, { group: "New substance", item: "Burning wood" });
      await sortItem(page, { group: "Same substance", item: "Melting ice" });
      await sortItem(page, { group: "New substance", item: "Rusting iron" });
      await expect(page.getByText("All sorted. Check when you're ready.")).toBeVisible();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("3 of 3 in the right group")).toBeVisible();
    });

    test("categorize: a misplaced item says where it belongs and why", async ({ page }) => {
      await openActivity(page, { mode, template: "categorize" });
      await sortItem(page, { group: "Same substance", item: "Burning wood" });
      await sortItem(page, { group: "Same substance", item: "Melting ice" });
      await sortItem(page, { group: "New substance", item: "Rusting iron" });
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("Burning wood belongs in New substance.")).toBeVisible();
      await expect(page.getByText("Ash and gas form.")).toBeVisible();
    });

    test("match pairs: matching each pair on the first try is right", async ({ page }) => {
      await openActivity(page, { mode, template: "matchPairs" });
      await matchCards(page, "embarazada", "pregnant");
      await matchCards(page, "éxito", "success");
      await expect(page.getByText("2 of 2 pairs matched", { exact: true })).toBeVisible();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("Look-alikes with no match")).toBeVisible();
    });

    test("match pairs: a trap explains itself and the first try counts", async ({ page }) => {
      await openActivity(page, { mode, template: "matchPairs" });
      await matchCards(page, "embarazada", "embarrassed");

      await expect(
        page.getByText("It looks alike but means something else.", { exact: true }),
      ).toBeVisible();

      await expect(page.getByRole("button", { name: "Check" })).toBeDisabled();
      await matchCards(page, "embarazada", "pregnant");
      await matchCards(page, "éxito", "success");
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("embarazada goes with pregnant, not embarrassed.")).toBeVisible();
    });

    test("argument builder: the strong quote and reasoning are right", async ({ page }) => {
      await openActivity(page, { mode, template: "argumentBuilder" });
      await page.getByRole("button", { name: /Use as evidence: It is too rash/u }).click();
      await page.getByRole("button", { name: /Use as reasoning: Juliet herself/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("It names the speed.")).toBeVisible();
    });

    test("argument builder: a weak quote names the stronger one", async ({ page }) => {
      await openActivity(page, { mode, template: "argumentBuilder" });
      await page.getByRole("button", { name: /Use as evidence: O brawling love/u }).click();
      await page.getByRole("button", { name: "Take the quote out" }).click();
      await page.getByRole("button", { name: /Use as evidence: O brawling love/u }).click();
      await page.getByRole("button", { name: /Use as reasoning: Juliet herself/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("Stronger evidence")).toBeVisible();
      await expect(page.getByText("It is about Rosaline.")).toBeVisible();
    });

    test("find the error: tapping the wrong step shows its fix", async ({ page }) => {
      await openActivity(page, { mode, template: "findError" });
      await page.getByRole("button", { name: /Step 2: Down 20%/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("120 × 0.8 = 96, not 100.")).toBeVisible();
    });

    test("find the error: another step points to the wrong one", async ({ page }) => {
      await openActivity(page, { mode, template: "findError" });
      await page.getByRole("button", { name: /Step 3: So the price/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("The wrong step is step 2.")).toBeVisible();
    });

    test("spot the AI's mistake: the answer is labeled as an AI assistant's", async ({ page }) => {
      const fixture = activityContentFixtures.findError;
      const content = { ...fixture, fields: { ...fixture.fields, author: "ai" } };

      await openActivity(page, { content, mode, template: "findError" });

      await expect(page.getByText("Someone asked an AI assistant")).toBeVisible();
      await expect(page.getByRole("list", { name: "The AI assistant's answer" })).toBeVisible();
      await page.getByRole("button", { name: /Step 2: Down 20%/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
    });

    test("decision tree: following the case reaches its outcome", async ({ page }) => {
      await openActivity(page, { mode, template: "decisionTree" });
      await expect(page.getByRole("list", { name: "Still possible" })).toContainText("Oak");
      await page.getByRole("button", { name: "Needles" }).click();
      await expect(page.getByRole("list", { name: "Still possible" })).not.toContainText("Oak");
      await page.getByRole("button", { name: "In bundles" }).click();
      await expect(page.getByText("The key leads to")).toBeVisible();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("It leads to Pine.")).toBeVisible();
    });

    test("decision tree: the case comes with its picture, or its description until drawn", async ({
      page,
    }) => {
      const content = { ...activityContentFixtures.decisionTree, image: LEAF };

      const asset = await mediaAssetFixture({
        height: 1024,
        url: "/catalog/chapters/science.webp",
        width: 1536,
      });

      await openActivity(page, { content, mediaAssetId: asset.id, mode, template: "decisionTree" });
      await expect(page.getByRole("img", { name: LEAF.alt })).toBeVisible();

      await openActivity(page, { content, mode, template: "decisionTree" });
      await expect(page.getByText(LEAF.alt)).toBeVisible();
      await expect(page.getByRole("img", { name: LEAF.alt })).toHaveCount(0);
    });

    test("decision tree: undo steps back, and a wrong branch is shown", async ({ page }) => {
      await openActivity(page, { mode, template: "decisionTree" });
      await page.getByRole("button", { name: "Broad leaves" }).click();
      await page.getByRole("button", { name: "Undo" }).click();
      await page.getByRole("button", { name: "Needles" }).click();
      await page.getByRole("button", { name: "Single" }).click();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
      await expect(page.getByText("You chose Single")).toBeVisible();
    });
  });
}

test.describe("reasoning activities with only a keyboard", () => {
  test("categorize: Space picks an item and its group, then Check", async ({ page }) => {
    await openActivity(page, { mode: "focus", template: "categorize" });

    const placements = [
      ["Burning wood", "New substance"],
      ["Melting ice", "Same substance"],
      ["Rusting iron", "New substance"],
    ] as const;

    for (const [item, group] of placements) {
      // oxlint-disable-next-line no-await-in-loop -- Each item is sorted in turn.
      await page.getByRole("button", { exact: true, name: item }).focus();
      // oxlint-disable-next-line no-await-in-loop -- Each item is sorted in turn.
      await page.keyboard.press("Space");
      // oxlint-disable-next-line no-await-in-loop -- Each item is sorted in turn.
      await page.getByRole("button", { name: `Put ${item} in ${group}` }).focus();
      // oxlint-disable-next-line no-await-in-loop -- Each item is sorted in turn.
      await page.keyboard.press("Space");
    }

    await page.getByRole("button", { name: "Check" }).focus();
    await page.keyboard.press("Enter");
    await expectVerdict(page, "Correct!");
  });
});

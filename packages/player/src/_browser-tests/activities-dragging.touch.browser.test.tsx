import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import {
  expectVerdict,
  openActivity,
  press,
  pressOnPage,
  sortCard,
  sortedCard,
} from "../_test-utils/activity-player";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import {
  holdAndDrag,
  holdFinger,
  liftFinger,
  slideFinger,
  swipeFrom,
  swipeUpFrom,
  tap,
} from "../_test-utils/touch-screen";
import { buildLesson } from "../preview/preview-lesson";
import { activityStep } from "../preview/preview-steps";

const SWIPE_PX = 200;

/** A busy machine can deliver the flick after the hold that starts a drag; paused, the page's hold timer can't run out mid-swipe. */
async function flick(swipe: () => Promise<void>) {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  try {
    await swipe();
    vi.runOnlyPendingTimers();
  } finally {
    vi.useRealTimers();
  }
}

describe("dragging activity items with a finger", () => {
  it("labeled diagram: a name held and dragged onto a spot labels it", async () => {
    openActivity({ template: "labeledDiagram" });

    await holdAndDrag({
      from: page.getByRole("button", { name: "Put Right ventricle on spot 1" }),
      to: page.getByRole("button", { name: "Spot 3: empty" }),
    });

    await expect
      .element(page.getByRole("button", { name: "Spot 3: Right ventricle" }))
      .toBeVisible();
  });

  it("labeled diagram: a name dragged while its picture is drawn stays off the spots", async () => {
    const step = activityStep({
      content: activityContentFixtures.labeledDiagram,
      image: null,
      imagePending: true,
    });

    renderLessonPlayer({ lesson: buildLesson([step]) });
    await expect.element(page.getByText("Drawing the picture…")).toBeVisible();

    await holdAndDrag({
      from: page.getByRole("button", { name: "Put Right ventricle on spot 1" }),
      to: page.getByRole("button", { name: "Spot 3: empty" }),
    });

    await expect
      .element(page.getByRole("button", { name: "Spot 3: Right ventricle" }))
      .not.toBeInTheDocument();
  });

  it("argument builder: a quote held and dragged onto the evidence is picked", async () => {
    openActivity({ template: "argumentBuilder" });

    await holdAndDrag({
      from: page.getByRole("button", { name: /^Use as evidence: It is too rash/u }),
      to: page.getByRole("region", { name: "Evidence" }),
    });

    await expect.element(page.getByRole("button", { name: "Take the quote out" })).toBeVisible();
  });

  it("labeled diagram: a quick swipe over the names scrolls instead of dragging", async () => {
    openActivity({ template: "labeledDiagram" });
    const lastSpot = page.getByRole("button", { name: "Spot 5: empty" });
    await expect.element(lastSpot).toBeVisible();
    await expect.element(lastSpot).not.toBeInViewport();

    await flick(() =>
      swipeUpFrom(page.getByRole("button", { name: "Put Aorta on spot 1" }), SWIPE_PX),
    );

    await expect.element(lastSpot).toBeInViewport();
    await expect.element(page.getByRole("button", { name: "Put Aorta on spot 1" })).toBeVisible();
  });

  it("labeled diagram: tapping a name still puts it on the highlighted spot", async () => {
    openActivity({ template: "labeledDiagram" });

    // A busy machine can deliver the tap's end after the hold that starts a drag; paused, the page's hold timer can't run out mid-tap.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    try {
      await tap(page.getByRole("button", { name: "Put Aorta on spot 1" }));
    } finally {
      vi.useRealTimers();
    }

    await expect.element(page.getByRole("button", { name: "Spot 1: Aorta" })).toBeVisible();
  });

  it("categorize: the card held and dragged onto a group sorts it", async () => {
    openActivity({ template: "categorize" });

    await holdAndDrag({
      from: page.getByText("Melting ice", { exact: true }),
      to: page.getByRole("button", { name: "Same substance" }),
    });

    await expect.element(page.getByText("1 of 3 sorted", { exact: true })).toBeVisible();

    await expect
      .element(page.getByRole("button", { name: "Same substance" }).getByText("Melting ice"))
      .toBeVisible();
  });

  it("categorize: a quick swipe from the card down over a group sorts nothing", async () => {
    openActivity({ template: "categorize" });
    const card = page.getByText("Melting ice", { exact: true });
    const firstGroup = page.getByRole("button", { name: "New substance" });
    await expect.element(firstGroup).toBeVisible();

    const from = card.element().getBoundingClientRect();
    const to = firstGroup.element().getBoundingClientRect();

    await flick(() =>
      swipeFrom(card, { y: to.top + to.height / 2 - (from.top + from.height / 2) }),
    );

    await expect.element(page.getByText("0 of 3 sorted", { exact: true })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("categorize: holding a Move to choice moves the card instead of lifting its row", async () => {
    openActivity({ template: "categorize" });
    await sortCard({ group: "Same substance", item: "Melting ice" });
    await sortCard({ group: "Same substance", item: "Rusting iron" });
    await sortCard({ group: "New substance", item: "Burning wood" });
    await tap(sortedCard({ group: "Same substance", item: "Rusting iron" }));
    await holdFinger(page.getByRole("menuitem", { name: "New substance" }));
    await liftFinger();

    await expect
      .element(sortedCard({ group: "New substance", item: "Rusting iron" }))
      .toBeVisible();
  });

  it("categorize: a row still held when Check is pressed leaves the checked groups alone", async () => {
    openActivity({ template: "categorize" });
    await sortCard({ group: "Same substance", item: "Melting ice" });
    await sortCard({ group: "Same substance", item: "Rusting iron" });
    await sortCard({ group: "New substance", item: "Burning wood" });

    const finger = await holdFinger(sortedCard({ group: "Same substance", item: "Rusting iron" }));
    await slideFinger(finger, page.getByRole("region", { name: "New substance" }));
    await press("Enter");
    await expectVerdict("Not quite");
    await liftFinger();

    await expect.element(page.getByText("2 of 3 in the right group")).toBeVisible();

    await expect
      .element(page.getByRole("region", { name: "Same substance" }).getByText("Rusting iron"))
      .toBeVisible();
  });

  it("categorize: a number key that sorts the lifted last card wins over its drop", async () => {
    openActivity({ template: "categorize" });
    await sortCard({ group: "Same substance", item: "Melting ice" });
    await sortCard({ group: "New substance", item: "Rusting iron" });

    const finger = await holdFinger(page.getByText("Burning wood", { exact: true }));
    const over = await slideFinger(finger, page.getByRole("button", { name: "Same substance" }));
    await pressOnPage("1");
    await expect.element(page.getByText("All sorted. Choose a card to move it.")).toBeVisible();
    await slideFinger(over, page.getByRole("region", { name: "Same substance" }));
    await liftFinger();

    await expect
      .element(sortedCard({ group: "New substance", item: "Burning wood" }))
      .toBeVisible();
  });
});

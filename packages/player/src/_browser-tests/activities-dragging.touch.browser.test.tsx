import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { openActivity } from "../_test-utils/activity-player";
import { holdAndDrag, swipeUpFrom, tap } from "../_test-utils/touch-screen";

/** Far enough to scroll the lesson; a phone scrolls well before this. */
const SWIPE_PX = 200;

/** Played on a phone's touch screen (the touch instance in vitest.config.mts), with a finger. */
describe("dragging activity items with a finger", () => {
  it("labeled diagram: a name held and dragged onto a spot labels it", async () => {
    openActivity({ mode: "fun", template: "labeledDiagram" });

    await holdAndDrag({
      from: page.getByRole("button", { name: "Put Right ventricle on spot 1" }),
      to: page.getByRole("button", { name: "Spot 4, bottom: empty" }),
    });

    await expect
      .element(page.getByRole("button", { name: "Spot 4, bottom: Right ventricle" }))
      .toBeVisible();
  });

  it("categorize: an item held and dragged onto a group sorts it", async () => {
    openActivity({ template: "categorize" });

    await holdAndDrag({
      from: page.getByRole("button", { exact: true, name: "Burning wood" }),
      to: page.getByRole("region", { name: "New substance" }),
    });

    await expect.element(page.getByText("1 of 3 sorted", { exact: true })).toBeVisible();

    await expect
      .element(
        page
          .getByRole("region", { name: "New substance" })
          .getByRole("button", { exact: true, name: "Burning wood" }),
      )
      .toBeVisible();
  });

  it("argument builder: a quote held and dragged onto the evidence is picked", async () => {
    openActivity({ mode: "fun", template: "argumentBuilder" });

    await holdAndDrag({
      from: page.getByRole("button", { name: /^Use as evidence: It is too rash/u }),
      to: page.getByRole("region", { name: "Evidence" }),
    });

    await expect.element(page.getByRole("button", { name: "Take the quote out" })).toBeVisible();
  });

  it("labeled diagram: a quick swipe over the names scrolls instead of dragging", async () => {
    openActivity({ template: "labeledDiagram" });
    const lastSpot = page.getByRole("button", { name: "Spot 5, bottom right: empty" });
    await expect.element(lastSpot).toBeVisible();
    await expect.element(lastSpot).not.toBeInViewport();

    await swipeUpFrom(page.getByRole("button", { name: "Put Aorta on spot 1" }), SWIPE_PX);

    await expect.element(lastSpot).toBeInViewport();
    await expect.element(page.getByRole("button", { name: "Put Aorta on spot 1" })).toBeVisible();
  });

  it("labeled diagram: tapping a name still puts it on the highlighted spot", async () => {
    openActivity({ mode: "fun", template: "labeledDiagram" });
    await tap(page.getByRole("button", { name: "Put Aorta on spot 1" }));
    await expect.element(page.getByRole("button", { name: /^Spot 1, .*: Aorta$/u })).toBeVisible();
  });
});

import { describe, expect, it } from "vitest";
import { type Locator, page } from "vitest/browser";
import { dragOnto, openActivity } from "../_test-utils/activity-player";

const MOVE_STEPS = 12;

/** Brings the target on screen with the item still in view, as a learner sees both before a drag. */
async function dragWithMouse({ from, to }: { from: Locator; to: Locator }) {
  await expect.element(to).toBeVisible();
  to.element().scrollIntoView({ block: "nearest" });
  await expect.element(from).toBeInViewport();
  await dragOnto(from, to, { steps: MOVE_STEPS });
}

describe("dragging activity items with a mouse", () => {
  it("labeled diagram: a name dragged onto a spot labels it", async () => {
    openActivity({ template: "labeledDiagram" });

    await dragWithMouse({
      from: page.getByRole("button", { name: "Put Right ventricle on spot 1" }),
      to: page.getByRole("button", { name: "Spot 4, bottom: empty" }),
    });

    await expect
      .element(page.getByRole("button", { name: "Spot 4, bottom: Right ventricle" }))
      .toBeVisible();
  });

  it("categorize: an item dragged onto a group is sorted into it", async () => {
    openActivity({ mode: "fun", template: "categorize" });

    await dragWithMouse({
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

  it("argument builder: a quote dragged onto the evidence is picked", async () => {
    openActivity({ template: "argumentBuilder" });

    await dragWithMouse({
      from: page.getByRole("button", { name: /^Use as evidence: It is too rash/u }),
      to: page.getByRole("region", { name: "Evidence" }),
    });

    await expect.element(page.getByRole("button", { name: "Take the quote out" })).toBeVisible();
  });
});

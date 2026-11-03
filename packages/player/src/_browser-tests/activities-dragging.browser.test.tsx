import { describe, expect, it } from "vitest";
import { type Locator, page } from "vitest/browser";
import { dragOnto, openActivity } from "../_test-utils/activity-player";

const MOVE_STEPS = 12;

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
      to: page.getByRole("button", { name: "Spot 3: empty" }),
    });

    await expect
      .element(page.getByRole("button", { name: "Spot 3: Right ventricle" }))
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

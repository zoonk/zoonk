import { describe, expect, it, vi } from "vitest";
import { type Locator, page } from "vitest/browser";
import {
  checkActivity,
  dragBy,
  dragOnto,
  expectVerdict,
  openActivity,
  sortCard,
  sortedCard,
} from "../_test-utils/activity-player";

const MOVE_STEPS = 12;

const ABOVE_GROUP_PX = 6;

async function dragWithMouse({ from, to }: { from: Locator; to: Locator }) {
  await expect.element(to).toBeVisible();
  to.element().scrollIntoView({ block: "nearest" });
  await expect.element(from).toBeInViewport();

  // dnd-kit swallows clicks until 50 ms after a drag ends; running its timer lets the next click land, as a person's would.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  try {
    await dragOnto(from, to, { steps: MOVE_STEPS });
    vi.runOnlyPendingTimers();
  } finally {
    vi.useRealTimers();
  }
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

  it("categorize: the card dragged onto a group is sorted into it", async () => {
    openActivity({ template: "categorize" });

    await dragWithMouse({
      from: page.getByText("Melting ice", { exact: true }),
      to: page.getByRole("button", { name: "Same substance" }),
    });

    await expect.element(page.getByText("1 of 3 sorted", { exact: true })).toBeVisible();

    await expect
      .element(page.getByRole("button", { name: "Same substance" }).getByText("Melting ice"))
      .toBeVisible();

    await expect.element(page.getByText("Rusting iron", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.element(page.getByText("0 of 3 sorted", { exact: true })).toBeVisible();
  });

  it("categorize: a card let go just above the first group stays in hand", async () => {
    openActivity({ template: "categorize" });
    const card = page.getByText("Melting ice", { exact: true });
    const firstGroup = page.getByRole("button", { name: "New substance" });
    await expect.element(firstGroup).toBeVisible();

    const grabbed = card.element().getBoundingClientRect();
    const groupTop = firstGroup.element().getBoundingClientRect().top;

    await dragBy(card, { x: 0, y: groupTop - ABOVE_GROUP_PX - (grabbed.top + grabbed.height / 2) });

    await expect.element(page.getByText("0 of 3 sorted", { exact: true })).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Undo" })).not.toBeInTheDocument();
  });

  it("categorize: a sorted card dragged onto another group moves there", async () => {
    openActivity({ template: "categorize" });
    await sortCard({ group: "Same substance", item: "Melting ice" });
    await sortCard({ group: "Same substance", item: "Rusting iron" });
    await sortCard({ group: "New substance", item: "Burning wood" });

    await dragWithMouse({
      from: sortedCard({ group: "Same substance", item: "Rusting iron" }),
      to: page.getByRole("region", { name: "New substance" }),
    });

    await expect
      .element(sortedCard({ group: "New substance", item: "Rusting iron" }))
      .toBeVisible();

    await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
    await checkActivity();
    await expectVerdict("Correct!");
  });
});

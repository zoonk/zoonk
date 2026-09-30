import { type Locator } from "@playwright/test";
import { openActivity } from "./activity-lesson";
import { type Page, expect, test } from "./fixtures";
import { MODES } from "./learn-personas";

/** A small phone, where the lesson scrolls and the Check bar sits over the bottom of it. */
const PHONE = { hasTouch: true, isMobile: true, viewport: { height: 812, width: 375 } };

/** Longer than a press takes to lift an item: shorter touches scroll the page instead. */
const HOLD_MS = 400;

const MOVE_STEPS = 12;

/** Far enough to scroll the lesson; a phone scrolls well before this. */
const SWIPE_PX = 200;

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox();

  if (!box) {
    throw new Error("The element isn't on the page.");
  }

  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Brings the target on screen with the item still in view, as a learner sees both before a drag.
 * Scrolling while an item is pressed but not yet lifted would move it away from the pointer, so
 * nothing scrolls once the press starts.
 */
async function showBoth({ from, to }: { from: Locator; to: Locator }) {
  await to.scrollIntoViewIfNeeded();
  await expect(from).toBeInViewport();
}

/**
 * A finger pressing an item, holding it and dragging it onto a target, sent through the
 * browser's own touch input: the page scrolls and cancels pointers the way a phone does, which
 * synthetic touch events skip.
 */
async function dragWithFinger(page: Page, { from, to }: { from: Locator; to: Locator }) {
  await showBoth({ from, to });
  const [start, end] = await Promise.all([centerOf(from), centerOf(to)]);
  const touch = await page.context().newCDPSession(page);

  await touch.send("Input.dispatchTouchEvent", { touchPoints: [start], type: "touchStart" });

  // The hold is the gesture itself, not a wait for the page: a finger rests before it drags.
  await page.waitForTimeout(HOLD_MS);

  for (let step = 1; step <= MOVE_STEPS; step += 1) {
    const point = {
      x: start.x + ((end.x - start.x) * step) / MOVE_STEPS,
      y: start.y + ((end.y - start.y) * step) / MOVE_STEPS,
    };

    // oxlint-disable-next-line no-await-in-loop -- A finger moves through each point in turn.
    await touch.send("Input.dispatchTouchEvent", { touchPoints: [point], type: "touchMove" });
  }

  await touch.send("Input.dispatchTouchEvent", { touchPoints: [], type: "touchEnd" });
  await touch.detach();
}

/** A quick finger swipe up from an item, with no hold first. */
async function swipeUpFrom(page: Page, from: Locator) {
  const start = await centerOf(from);
  const touch = await page.context().newCDPSession(page);

  await touch.send("Input.dispatchTouchEvent", { touchPoints: [start], type: "touchStart" });

  for (let step = 1; step <= MOVE_STEPS; step += 1) {
    const point = { x: start.x, y: start.y - (SWIPE_PX * step) / MOVE_STEPS };
    // oxlint-disable-next-line no-await-in-loop -- A finger moves through each point in turn.
    await touch.send("Input.dispatchTouchEvent", { touchPoints: [point], type: "touchMove" });
  }

  await touch.send("Input.dispatchTouchEvent", { touchPoints: [], type: "touchEnd" });
  await touch.detach();
}

async function dragWithMouse({ from, to }: { from: Locator; to: Locator }) {
  await showBoth({ from, to });
  await from.dragTo(to, { steps: MOVE_STEPS });
}

function heartDrag(page: Page) {
  return {
    from: page.getByRole("button", { name: "Put Right ventricle on spot 1" }),
    to: page.getByRole("button", { name: "Spot 4, bottom: empty" }),
  };
}

function sortingDrag(page: Page) {
  return {
    from: page.getByRole("button", { exact: true, name: "Burning wood" }),
    to: page.getByRole("region", { name: "New substance" }),
  };
}

function evidenceDrag(page: Page) {
  return {
    from: page.getByRole("button", { name: /^Use as evidence: It is too rash/u }),
    to: page.getByRole("region", { name: "Evidence" }),
  };
}

async function expectHeartLabeled(page: Page) {
  await expect(page.getByRole("button", { name: "Spot 4, bottom: Right ventricle" })).toBeVisible();
}

async function expectSorted(page: Page) {
  await expect(page.getByText("1 of 3 sorted", { exact: true })).toBeVisible();

  await expect(
    page
      .getByRole("region", { name: "New substance" })
      .getByRole("button", { exact: true, name: "Burning wood" }),
  ).toBeVisible();
}

async function expectEvidencePicked(page: Page) {
  await expect(page.getByRole("button", { name: "Take the quote out" })).toBeVisible();
}

for (const mode of MODES) {
  test.describe(`dragging activity items with a mouse in ${mode} mode`, () => {
    test("labeled diagram: a name dragged onto a spot labels it", async ({ page }) => {
      await openActivity(page, { mode, template: "labeledDiagram" });
      await dragWithMouse(heartDrag(page));
      await expectHeartLabeled(page);
    });

    test("categorize: an item dragged onto a group is sorted into it", async ({ page }) => {
      await openActivity(page, { mode, template: "categorize" });
      await dragWithMouse(sortingDrag(page));
      await expectSorted(page);
    });

    test("argument builder: a quote dragged onto the evidence is picked", async ({ page }) => {
      await openActivity(page, { mode, template: "argumentBuilder" });
      await dragWithMouse(evidenceDrag(page));
      await expectEvidencePicked(page);
    });
  });

  test.describe(`dragging activity items on a phone in ${mode} mode`, () => {
    test.use(PHONE);

    test("labeled diagram: a name dragged onto a spot with a mouse labels it", async ({ page }) => {
      await openActivity(page, { mode, template: "labeledDiagram" });
      await dragWithMouse(heartDrag(page));
      await expectHeartLabeled(page);
    });

    test("labeled diagram: a name held and dragged onto a spot with a finger labels it", async ({
      page,
    }) => {
      await openActivity(page, { mode, template: "labeledDiagram" });
      await dragWithFinger(page, heartDrag(page));
      await expectHeartLabeled(page);
    });

    test("categorize: an item held and dragged onto a group with a finger sorts it", async ({
      page,
    }) => {
      await openActivity(page, { mode, template: "categorize" });
      await dragWithFinger(page, sortingDrag(page));
      await expectSorted(page);
    });

    test("argument builder: a quote held and dragged onto the evidence with a finger is picked", async ({
      page,
    }) => {
      await openActivity(page, { mode, template: "argumentBuilder" });
      await dragWithFinger(page, evidenceDrag(page));
      await expectEvidencePicked(page);
    });

    test("labeled diagram: a quick swipe over the names scrolls instead of dragging", async ({
      page,
    }) => {
      await openActivity(page, { mode, template: "labeledDiagram" });
      const lastSpot = page.getByRole("button", { name: "Spot 5, bottom right: empty" });
      await expect(lastSpot).not.toBeInViewport();

      await swipeUpFrom(page, page.getByRole("button", { name: "Put Aorta on spot 1" }));

      await expect(lastSpot).toBeInViewport();
      await expect(page.getByRole("button", { name: "Put Aorta on spot 1" })).toBeVisible();
    });

    test("labeled diagram: tapping a name still puts it on the highlighted spot", async ({
      page,
    }) => {
      await openActivity(page, { mode, template: "labeledDiagram" });
      await page.getByRole("button", { name: "Put Aorta on spot 1" }).tap();
      await expect(page.getByRole("button", { name: /^Spot 1, .*: Aorta$/u })).toBeVisible();
    });
  });
}

import { choiceCheck } from "@zoonk/testing/fixtures/activity-checks";
import {
  activityContentFixtures,
  engineModeFixtures,
} from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it, onTestFinished } from "vitest";
import { page } from "vitest/browser";
import {
  checkActivity,
  dragBy,
  expectVerdict,
  focusOn,
  openActivity,
  press,
  pressOnSlider,
  valueInput,
} from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";

const polls = engineModeFixtures.randomSimulation.sampling;
const FOCUS_RING = 17;

function dialText(matches: (text: string) => boolean): DOMRect | undefined {
  return [...(document.querySelector("figure svg")?.querySelectorAll("text") ?? [])]
    .find((text) => matches(text.textContent ?? ""))
    ?.getBoundingClientRect();
}

describe("geometry and data activities", () => {
  it("geometry board: the angles are worked out from the parts", async () => {
    openActivity({ template: "geometryBoard" });

    await expect
      .element(page.getByRole("slider", { name: "Corner C" }))
      .toHaveAttribute("aria-valuetext", expect.stringMatching(/Angles: 72°, 45°, 63°\.$/u));

    await valueInput().fill("180");
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("The angles always add to 180°.")).toBeVisible();
  });

  it("geometry board: the total a choice asks for waits for the check", async () => {
    const corner = page.getByRole("slider", { name: "Corner C" });

    openActivity({
      content: {
        ...activityContentFixtures.geometryBoard,
        check: choiceCheck("What do the angles add up to?", [
          ["90°", false, 90],
          ["180°", true, 180],
          ["360°", false, 360],
        ]),
      },
      template: "geometryBoard",
    });

    await expect
      .element(corner)
      .toHaveAttribute("aria-valuetext", expect.stringMatching(/Angles: 72°, 45°, 63°\.$/u));

    await page.getByRole("radio", { name: /^180°/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");

    await expect
      .element(corner)
      .toHaveAttribute("aria-valuetext", expect.stringMatching(/adding up to 180°\.$/u));
  });

  it("geometry board: a wrong sum shows the real one", async () => {
    openActivity({ template: "geometryBoard" });
    await valueInput().fill("90");
    await checkActivity();
    await expectVerdict("Not quite");

    await expect
      .element(
        page.getByRole("region", { name: "Answer feedback" }).getByText("180", { exact: true }),
      )
      .toBeVisible();
  });

  it("unit circle: turning to the check's angle answers it", async () => {
    openActivity({ template: "unitCircle" });
    await pressOnSlider("Point on the circle", "ArrowRight", 6);
    await expect.element(valueInput()).toHaveValue("0.5");
    await checkActivity();
    await expectVerdict("Correct!");

    await expect
      .element(page.getByRole("figure"))
      .toMatchTextContent("The question asks about 30°, where sin = 0.5.");
  });

  it("unit circle: on a phone the sine's value sits by its leg", async () => {
    await atViewport({ height: 812, width: 375 }, async () => {
      openActivity({ template: "unitCircle" });
      await pressOnSlider("Point on the circle", "ArrowRight", 6);
      await expect.element(valueInput()).toHaveValue("0.5");

      const dial = document.querySelector("figure svg");
      const leg = dial?.querySelector("path.stroke-viz-highlight")?.getBoundingClientRect();

      const box = [...(dial?.querySelectorAll("text") ?? [])]
        .find((text) => text.textContent === "sin = 0.5")
        ?.getBoundingClientRect();

      const gap =
        box && leg
          ? Math.hypot(
              Math.max(box.left - leg.right, 0, leg.left - box.right),
              Math.max(box.top - leg.bottom, 0, leg.top - box.bottom),
            )
          : Number.POSITIVE_INFINITY;

      expect(gap).toBeLessThan(32);
    });
  });

  it("unit circle: in large text the sine's value stays clear of the point", async () => {
    document.documentElement.style.fontSize = "200%";

    onTestFinished(() => {
      document.documentElement.style.removeProperty("font-size");
    });

    await atViewport({ height: 812, width: 375 }, async () => {
      openActivity({ template: "unitCircle" });
      await pressOnSlider("Point on the circle", "ArrowRight", 6);
      await expect.element(valueInput()).toHaveValue("0.5");

      const point = page.getByRole("slider", { name: "Point on the circle" }).element();
      const ring = point.getBoundingClientRect();
      const center = { x: ring.left + ring.width / 2, y: ring.top + ring.height / 2 };

      const box = [...(document.querySelector("figure svg")?.querySelectorAll("text") ?? [])]
        .find((text) => text.textContent === "sin = 0.5")
        ?.getBoundingClientRect();

      const gap = box
        ? Math.hypot(
            Math.max(box.left - center.x, 0, center.x - box.right),
            Math.max(box.top - center.y, 0, center.y - box.bottom),
          )
        : 0;

      expect(gap).toBeGreaterThan(FOCUS_RING);
    });
  });

  it("unit circle: in large text a long negative sine value stays inside the dial", async () => {
    document.documentElement.style.fontSize = "200%";

    onTestFinished(() => {
      document.documentElement.style.removeProperty("font-size");
    });

    await atViewport({ height: 812, width: 375 }, async () => {
      openActivity({ template: "unitCircle" });
      await pressOnSlider("Point on the circle", "End", 1);
      await press("ArrowLeft", 3);

      const dial = document.querySelector("figure svg");

      const sine = () =>
        [...(dial?.querySelectorAll("text") ?? [])].find((text) =>
          /^sin = [-−]/u.test(text.textContent ?? ""),
        );

      await expect.poll(sine).toBeDefined();

      const box = sine()?.getBoundingClientRect();
      const edges = dial?.getBoundingClientRect();

      expect(box?.left).toBeGreaterThanOrEqual(edges?.left ?? Number.POSITIVE_INFINITY);
      expect(box?.right).toBeLessThanOrEqual(edges?.right ?? Number.NEGATIVE_INFINITY);
    });
  });

  it("unit circle: in large text the cos value and the angle stay apart at 345°", async () => {
    document.documentElement.style.fontSize = "200%";

    onTestFinished(() => {
      document.documentElement.style.removeProperty("font-size");
    });

    await atViewport({ height: 812, width: 375 }, async () => {
      openActivity({ template: "unitCircle" });
      await pressOnSlider("Point on the circle", "End", 1);
      await press("ArrowLeft", 3);

      await expect.poll(() => dialText((text) => text === "345°")).toBeDefined();

      const angle = dialText((text) => text === "345°");
      const cos = dialText((text) => text.startsWith("cos = "));

      const apart =
        angle && cos
          ? Math.max(
              cos.left - angle.right,
              angle.left - cos.right,
              cos.top - angle.bottom,
              angle.top - cos.bottom,
            )
          : Number.NEGATIVE_INFINITY;

      expect(apart).toBeGreaterThan(0);
    });
  });

  it("unit circle: reading the wrong angle is wrong", async () => {
    openActivity({ template: "unitCircle" });
    await pressOnSlider("Point on the circle", "ArrowRight", 3);
    await checkActivity();
    await expectVerdict("Not quite");
  });

  it("distribution explorer: covering the target gives its share", async () => {
    openActivity({ template: "distributionExplorer" });
    await pressOnSlider("Lower handle", "ArrowLeft", 4);
    await pressOnSlider("Upper handle", "ArrowRight", 4);
    await expect.element(valueInput()).toHaveValue("95.45");
    await checkActivity();
    await expectVerdict("Correct!");
    await expect.element(page.getByText("70 to 130: 95.4%")).toBeVisible();
  });

  it("distribution explorer: half the range gives the wrong share", async () => {
    openActivity({ template: "distributionExplorer" });
    await pressOnSlider("Lower handle", "ArrowLeft", 4);
    await checkActivity();
    await expectVerdict("Not quite");
  });

  it("random simulation by sampling: bigger samples bunch up", async () => {
    openActivity({ content: polls, template: "randomSimulation" });
    await expect.element(page.getByText("200 samples of 400", { exact: true })).toBeVisible();
    await expect.element(page.getByText("Example numbers, not real data")).toBeVisible();
    await page.getByRole("radio", { name: /Half as big/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");

    await expect
      .element(page.getByText("From 100 to 400, the margin shrinks to 50% of its size."))
      .toBeVisible();
  });

  it("random simulation by sampling: a margin shown as 1 is one point", async () => {
    openActivity({
      content: { ...polls, fields: { ...polls.fields, sampleSizes: [100, 8000] } },
      template: "randomSimulation",
    });

    await expect.element(page.getByText("±1 point", { exact: true })).toBeVisible();
  });

  it("random simulation by sampling: the wrong guess is marked", async () => {
    openActivity({ content: polls, template: "randomSimulation" });
    await page.getByRole("radio", { name: /The same/u }).click();
    await checkActivity();
    await expectVerdict("Not quite");
  });
});

describe("geometry and data activities with a keyboard or a pointer", () => {
  it("geometry board: arrow keys and dragging move a corner", async () => {
    openActivity({ template: "geometryBoard" });
    const corner = page.getByRole("slider", { name: "Corner C" });

    await focusOn(corner);
    await press("ArrowUp");

    await expect
      .element(corner)
      .toHaveAttribute(
        "aria-valuetext",
        expect.stringMatching(/^At 1, 4\. Angles: 76°, 53°, 51°\.$/u),
      );

    await page.getByRole("button", { name: "Back to the start" }).click();

    await expect
      .element(corner)
      .toHaveAttribute("aria-valuetext", expect.stringMatching(/^At 1, 3\./u));

    await dragBy(corner, { x: 60, y: -60 });

    await expect
      .element(corner)
      .not.toHaveAttribute("aria-valuetext", expect.stringMatching(/^At 1, 3\./u));
  });

  it("random simulation by sampling: the size slider switches the runs", async () => {
    openActivity({ content: polls, template: "randomSimulation" });
    await pressOnSlider("People per poll", "ArrowLeft", 1);
    await expect.element(page.getByText("200 samples of 100", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Run again" }).click();
    await expect.element(page.getByText("200 samples of 100", { exact: true })).toBeVisible();
  });
});

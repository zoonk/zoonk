import { describe, expect, it } from "vitest";
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

  it("geometry board: a wrong sum shows the real one", async () => {
    openActivity({ mode: "fun", template: "geometryBoard" });
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
    openActivity({ mode: "fun", template: "unitCircle" });
    await pressOnSlider("Point on the circle", "ArrowRight", 6);
    await expect.element(valueInput()).toHaveValue("0.5");
    await checkActivity();
    await expectVerdict("Correct!");

    await expect
      .element(page.getByRole("figure"))
      .toMatchTextContent("The question asks about 30°, where sin = 0.5.");
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
    openActivity({ mode: "fun", template: "distributionExplorer" });
    await pressOnSlider("Lower handle", "ArrowLeft", 4);
    await checkActivity();
    await expectVerdict("Not quite");
  });

  it("sampling simulator: bigger samples bunch up", async () => {
    openActivity({ mode: "fun", template: "samplingSimulator" });
    await expect.element(page.getByText("200 samples of 400")).toBeVisible();
    await page.getByRole("radio", { name: /Half as big/u }).click();
    await checkActivity();
    await expectVerdict("Correct!");

    await expect
      .element(page.getByText("From 100 to 400, the margin shrinks to 50% of its size."))
      .toBeVisible();
  });

  it("sampling simulator: the wrong guess is marked", async () => {
    openActivity({ template: "samplingSimulator" });
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

  it("sampling simulator: the size slider switches the runs", async () => {
    openActivity({ template: "samplingSimulator" });
    await pressOnSlider("People per poll", "ArrowLeft", 1);
    await expect.element(page.getByText("200 samples of 100")).toBeVisible();
    await page.getByRole("button", { name: "Run again" }).click();
    await expect.element(page.getByText("200 samples of 100")).toBeVisible();
  });
});

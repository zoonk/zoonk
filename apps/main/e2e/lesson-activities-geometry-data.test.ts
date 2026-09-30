import {
  checkActivity,
  expectVerdict,
  openActivity,
  pressOnSlider,
  valueInput,
} from "./activity-lesson";
import { expect, test } from "./fixtures";
import { MODES } from "./learn-personas";

for (const mode of MODES) {
  test.describe(`geometry and data activities in ${mode} mode`, () => {
    test("geometry board: the angles are worked out from the parts", async ({ page }) => {
      await openActivity(page, { mode, template: "geometryBoard" });

      await expect(page.getByRole("slider", { name: "Corner C" })).toHaveAttribute(
        "aria-valuetext",
        /Angles: 72°, 45°, 63°\.$/u,
      );

      await valueInput(page).fill("180");
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("The angles always add to 180°.")).toBeVisible();
    });

    test("geometry board: a wrong sum shows the real one", async ({ page }) => {
      await openActivity(page, { mode, template: "geometryBoard" });
      await valueInput(page).fill("90");
      await checkActivity(page);
      await expectVerdict(page, "Not quite");

      await expect(
        page.getByRole("region", { name: "Answer feedback" }).getByText("180", { exact: true }),
      ).toBeVisible();
    });

    test("unit circle: turning to the check's angle answers it", async ({ page }) => {
      await openActivity(page, { mode, template: "unitCircle" });
      await pressOnSlider(page, "Point on the circle", "ArrowRight", 6);
      await expect(valueInput(page)).toHaveValue("0.5");
      await checkActivity(page);
      await expectVerdict(page, "Correct!");

      await expect(page.getByRole("figure")).toContainText(
        "The question asks about 30°, where sin = 0.5.",
      );
    });

    test("unit circle: reading the wrong angle is wrong", async ({ page }) => {
      await openActivity(page, { mode, template: "unitCircle" });
      await pressOnSlider(page, "Point on the circle", "ArrowRight", 3);
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
    });

    test("distribution explorer: covering the target gives its share", async ({ page }) => {
      await openActivity(page, { mode, template: "distributionExplorer" });
      await pressOnSlider(page, "Lower handle", "ArrowLeft", 4);
      await pressOnSlider(page, "Upper handle", "ArrowRight", 4);
      await expect(valueInput(page)).toHaveValue("95.45");
      await checkActivity(page);
      await expectVerdict(page, "Correct!");
      await expect(page.getByText("70 to 130: 95.4%")).toBeVisible();
    });

    test("distribution explorer: half the range gives the wrong share", async ({ page }) => {
      await openActivity(page, { mode, template: "distributionExplorer" });
      await pressOnSlider(page, "Lower handle", "ArrowLeft", 4);
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
    });

    test("sampling simulator: bigger samples bunch up", async ({ page }) => {
      await openActivity(page, { mode, template: "samplingSimulator" });
      await expect(page.getByText("200 samples of 400")).toBeVisible();
      await page.getByRole("radio", { name: /Half as big/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Correct!");

      await expect(
        page.getByText("From 100 to 400, the margin shrinks to 50% of its size."),
      ).toBeVisible();
    });

    test("sampling simulator: the wrong guess is marked", async ({ page }) => {
      await openActivity(page, { mode, template: "samplingSimulator" });
      await page.getByRole("radio", { name: /The same/u }).click();
      await checkActivity(page);
      await expectVerdict(page, "Not quite");
    });
  });
}

test.describe("geometry and data activities with a keyboard or a pointer", () => {
  test("geometry board: arrow keys and dragging move a corner", async ({ page }) => {
    await openActivity(page, { mode: "focus", template: "geometryBoard" });
    const corner = page.getByRole("slider", { name: "Corner C" });

    await corner.focus();
    await corner.press("ArrowUp");
    await expect(corner).toHaveAttribute("aria-valuetext", /^At 1, 4\. Angles: 76°, 53°, 51°\.$/u);

    await page.getByRole("button", { name: "Back to the start" }).click();
    await expect(corner).toHaveAttribute("aria-valuetext", /^At 1, 3\./u);

    const box = await corner.boundingBox();

    if (!box) {
      throw new Error("The corner isn't on screen");
    }

    const [centerX, centerY] = [box.x + box.width / 2, box.y + box.height / 2];
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 60, centerY - 60, { steps: 6 });
    await page.mouse.up();

    await expect(corner).not.toHaveAttribute("aria-valuetext", /^At 1, 3\./u);
  });

  test("sampling simulator: the size slider switches the runs", async ({ page }) => {
    await openActivity(page, { mode: "focus", template: "samplingSimulator" });
    await pressOnSlider(page, "People per poll", "ArrowLeft", 1);
    await expect(page.getByText("200 samples of 100")).toBeVisible();
    await page.getByRole("button", { name: "Run again" }).click();
    await expect(page.getByText("200 samples of 100")).toBeVisible();
  });
});

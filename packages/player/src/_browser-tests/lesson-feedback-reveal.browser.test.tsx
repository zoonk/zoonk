import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import {
  checkActivity,
  expectVerdict,
  openActivity,
  pressOnSlider,
} from "../_test-utils/activity-player";
import { atViewport } from "../_test-utils/browser-viewport";
import { onDevice } from "../_test-utils/device-media";

const LANDSCAPE_TABLET = { height: 912, width: 1368 };

describe("feedback after a check", () => {
  it("shows the verdict on a tablet without scrolling the question away", async () => {
    await onDevice({ reducedMotion: "reduce" }, () =>
      atViewport(LANDSCAPE_TABLET, async () => {
        openActivity({ template: "unitCircle" });
        await pressOnSlider("Point on the circle", "ArrowRight", 6);
        await checkActivity();
        await expectVerdict("Correct!");

        const scroller = page.getByRole("main", { name: "Lesson content" }).element();
        await expect.poll(() => scroller.scrollTop).toBeGreaterThan(0);

        const question = page.getByRole("heading", { name: "Turn the wheel to 30°." }).element();
        const verdict = page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!");

        expect(question.getBoundingClientRect().top).toBeGreaterThanOrEqual(
          scroller.getBoundingClientRect().top,
        );

        await expect.element(verdict).toBeInViewport({ ratio: 1 });
      }),
    );
  });
});

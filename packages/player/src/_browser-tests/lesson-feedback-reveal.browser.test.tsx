import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
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
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep } from "../preview/preview-steps";

const LANDSCAPE_TABLET = { height: 912, width: 1368 };
const SHORT_WINDOW = { height: 420, width: 1024 };
const RIGHT_OPTION = "Where the electron is most likely to be found";

const LONG_REASON = Array.from(
  { length: 6 },
  () => "Where the cloud is densest, the electron is most likely to be.",
).join(" ");

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}

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

  it("keeps a question with no badge in view when its verdict fits but the reason runs on", async () => {
    const content = {
      ...playableStepContent.check,
      options: playableStepContent.check.options.map((option) =>
        option.isCorrect ? { ...option, reason: LONG_REASON } : option,
      ),
    };

    await onDevice({ reducedMotion: "reduce" }, () =>
      atViewport(SHORT_WINDOW, async () => {
        renderLessonPlayer({ lesson: buildLesson([contentStep("check", { content })]) });
        await page.getByRole("radio", { name: RIGHT_OPTION }).click();
        await page.getByRole("button", { name: /^Check/u }).click();

        await expect
          .poll(() => document.querySelector('[data-slot="feedback-verdict"]'))
          .not.toBeNull();

        await nextFrame();
        await nextFrame();

        const scroller = page.getByRole("main", { name: "Lesson content" }).element();
        const question = page.getByRole("heading", { name: content.question }).element();

        expect(question.getBoundingClientRect().top).toBeGreaterThanOrEqual(
          scroller.getBoundingClientRect().top,
        );

        await expect
          .element(page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!"))
          .toBeInViewport({ ratio: 1 });
      }),
    );
  });
});

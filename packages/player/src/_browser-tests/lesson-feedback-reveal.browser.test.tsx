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

function checkStep() {
  return contentStep("check", { content: playableStepContent.check });
}

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(resolve);
  });
}

describe("feedback after a check", () => {
  it("shows the whole feedback on a tablet, leaving no sliver of the chip over the question", async () => {
    await onDevice({ reducedMotion: "reduce" }, () =>
      atViewport(LANDSCAPE_TABLET, async () => {
        openActivity({ template: "unitCircle" });
        await pressOnSlider("Point on the circle", "ArrowRight", 6);
        await checkActivity();
        await expectVerdict("Correct!");

        const scroller = page.getByRole("main", { name: "Lesson content" }).element();
        await expect.poll(() => scroller.scrollTop).toBeGreaterThan(0);

        await expect
          .element(page.getByRole("region", { name: "Answer feedback" }))
          .toBeInViewport({ ratio: 1 });

        const chip = document
          .querySelector('[data-slot="activity-badge"]')
          ?.getBoundingClientRect();

        const top = scroller.getBoundingClientRect().top;

        expect(chip && (chip.top >= top || chip.bottom <= top)).toBe(true);
      }),
    );
  });

  it("starts a feedback taller than the screen at its top, so the verdict is read first", async () => {
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
        const feedback = page.getByRole("region", { name: "Answer feedback" }).element();

        expect(feedback.getBoundingClientRect().top).toBeGreaterThanOrEqual(
          scroller.getBoundingClientRect().top,
        );

        await expect
          .element(page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!"))
          .toBeInViewport({ ratio: 1 });
      }),
    );
  });

  it("shows the verdict again when a picture or canvas that loads after the check pushes it down", async () => {
    await onDevice({ reducedMotion: "reduce" }, () =>
      atViewport(SHORT_WINDOW, async () => {
        renderLessonPlayer({
          lesson: buildLesson([contentStep("check", { content: playableStepContent.check })]),
        });

        await page.getByRole("radio", { name: RIGHT_OPTION }).click();
        await page.getByRole("button", { name: /^Check/u }).click();

        const verdict = page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!");
        await expect.element(verdict).toBeInViewport({ ratio: 1 });

        const late = document.createElement("div");
        late.style.minHeight = "600px";
        document.querySelector('[data-slot="lesson-screen"]')?.prepend(late);

        await expect.element(verdict).toBeInViewport({ ratio: 1 });
      }),
    );
  });

  it("watches the screen the learner went back to, not the one checked last", async () => {
    await onDevice({ reducedMotion: "reduce" }, () =>
      atViewport(SHORT_WINDOW, async () => {
        renderLessonPlayer({ lesson: buildLesson([checkStep(), checkStep()]) });

        await page.getByRole("radio", { name: RIGHT_OPTION }).click();
        await page.getByRole("button", { name: /^Check/u }).click();
        await page.getByRole("button", { name: /^Continue/u }).click();
        await page.getByRole("radio", { name: RIGHT_OPTION }).click();
        await page.getByRole("button", { name: /^Check/u }).click();
        await page.getByRole("button", { name: "Previous screen" }).click();

        const verdict = page.getByRole("region", { name: "Answer feedback" }).getByText("Correct!");
        await expect.element(verdict).toBeInViewport({ ratio: 1 });

        const late = document.createElement("div");
        late.style.minHeight = "600px";

        [...document.querySelectorAll<HTMLElement>('[data-slot="lesson-screen"]')]
          .find((screen) => screen.getClientRects().length > 0)
          ?.prepend(late);

        await expect.element(verdict).toBeInViewport({ ratio: 1 });
      }),
    );
  });

  it("watches the earlier attempt of a retried question the learner went back to", async () => {
    await onDevice({ reducedMotion: "reduce" }, () =>
      atViewport(SHORT_WINDOW, async () => {
        renderLessonPlayer({ lesson: buildLesson([checkStep()]) });

        await page.getByRole("radio", { name: "The electron's size" }).click();
        await page.getByRole("button", { name: /^Check/u }).click();
        await page.getByRole("button", { name: /^Continue/u }).click();
        await page.getByRole("radio", { name: RIGHT_OPTION }).click();
        await page.getByRole("button", { name: /^Check/u }).click();
        await page.getByRole("button", { name: "Previous screen" }).click();

        const verdict = page
          .getByRole("region", { name: "Answer feedback" })
          .getByText("Not quite");

        await expect.element(verdict).toBeInViewport({ ratio: 1 });

        const late = document.createElement("div");
        late.style.minHeight = "600px";

        [...document.querySelectorAll<HTMLElement>('[data-slot="lesson-screen"]')]
          .find((screen) => screen.getClientRects().length > 0)
          ?.prepend(late);

        await expect.element(verdict).toBeInViewport({ ratio: 1 });
      }),
    );
  });
});

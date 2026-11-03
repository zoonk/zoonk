import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { MODULE_LOAD_TIMEOUT_MS } from "../_test-utils/module-load";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { buildLesson } from "../preview/preview-lesson";
import { activityStep, explanationStep, teachingStep } from "../preview/preview-steps";

const RARE_CODE = {
  katex: /\/math-markup\.ts|deps\/katex\.js/u,
  markdown: /\/tutor-markdown\.tsx|streamdown/u,
};

const CANVAS_CODE = {
  areaModel: /\/area-model-activity\.tsx/u,
  numberLine: /\/number-line-activity\.tsx/u,
};

function loaded(pattern: RegExp): boolean {
  return performance.getEntriesByType("resource").some((entry) => pattern.test(entry.name));
}

function drawnCanvas(screen: "activity-explore" | "activity-step"): Element | null {
  return document.querySelector(`[data-slot='${screen}'] [data-slot='activity-canvas']`);
}

function watchCanvasSkeletons(): () => boolean {
  let shown = false;

  const observer = new MutationObserver(() => {
    shown ||= document.querySelector("[data-slot='activity-canvas-skeleton']") !== null;
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    return shown;
  };
}

function check(question: string) {
  const step = teachingStep("check");
  return { ...step, content: { ...step.content, question } };
}

async function answerAndContinue() {
  await page.getByRole("radio", { name: "Where the electron is most likely to be found" }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await page.getByRole("button", { name: /^Continue/u }).click();
}

describe("a lesson's code", () => {
  it("plays a lesson without math or tutor answers without loading their code", async () => {
    renderLessonPlayer({ lesson: buildLesson([check("Which cloud fits?"), check("And now?")]) });

    await answerAndContinue();
    await expect.element(page.getByRole("heading", { name: "And now?" })).toBeVisible();
    await answerAndContinue();
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    expect(loaded(/\/lesson-step-view\.tsx/u)).toBe(true);
    expect(loaded(RARE_CODE.katex)).toBe(false);
    expect(loaded(RARE_CODE.markdown)).toBe(false);
  });

  it("loads a later screen's math while the first screen is read", async () => {
    renderLessonPlayer({
      lesson: buildLesson([
        check("Which cloud fits?"),
        check(String.raw`At what speed \(v\) does it stay up?`),
      ]),
    });

    await expect.element(page.getByRole("heading", { name: "Which cloud fits?" })).toBeVisible();

    await expect
      .poll(() => loaded(RARE_CODE.katex), { timeout: MODULE_LOAD_TIMEOUT_MS })
      .toBe(true);

    await answerAndContinue();
    await expect.element(page.getByRole("heading", { name: /At what speed/u })).toBeVisible();
    expect(document.querySelectorAll("math")).toHaveLength(1);
  });

  it("draws later screens' activities at once, their code loaded while the first screen is read", async () => {
    const { fields } = activityContentFixtures.areaModel;

    renderLessonPlayer({
      lesson: buildLesson([
        check("Which cloud fits?"),
        explanationStep({ explore: { fields, template: "areaModel" }, text: "Split it." }),
        activityStep({ content: activityContentFixtures.numberLine }),
      ]),
    });

    await expect.element(page.getByRole("heading", { name: "Which cloud fits?" })).toBeVisible();

    await expect
      .poll(() => loaded(CANVAS_CODE.areaModel) && loaded(CANVAS_CODE.numberLine), {
        timeout: MODULE_LOAD_TIMEOUT_MS,
      })
      .toBe(true);

    await Promise.all([
      import("../activities/area-model/area-model-activity"),
      import("../activities/number-line/number-line-activity"),
    ]);

    const skeletonShown = watchCanvasSkeletons();

    await answerAndContinue();
    const explanation = page.getByRole("paragraph").filter({ hasText: "Split it." });
    await expect.element(explanation).toBeVisible();
    expect(drawnCanvas("activity-explore")).not.toBeNull();

    await page.getByRole("button", { name: /^Next/u }).click();
    await expect.element(page.getByRole("heading", { name: /^At 7 am/u })).toBeVisible();
    expect(drawnCanvas("activity-step")).not.toBeNull();
    expect(skeletonShown()).toBe(false);
  });
});

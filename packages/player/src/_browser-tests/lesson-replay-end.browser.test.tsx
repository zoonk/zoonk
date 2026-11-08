import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { buildAdapters, renderLessonPlayer, startedRun } from "../_test-utils/render-lesson-player";
import { buildLesson, localAdapters } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

const ROUTES = {
  exit: "/chapter",
  exitTo: "chapter" as const,
  nextLesson: "/learn/next",
  seePlan: (goalId: string) => `/start/${goalId}`,
  signUp: "/login",
  upgrade: "/subscription",
};

async function finishLesson() {
  await page.getByRole("radio", { name: "Where the electron is most likely to be found" }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await page.getByRole("button", { name: /^Continue/u }).click();
  await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
}

describe("a lesson's end", () => {
  it("offers the chapter's next lesson after a first completion", async () => {
    const lesson = buildLesson([teachingStep("check")]);

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { startLesson: async () => startedRun({ replay: false }) }),
      lesson,
      routes: ROUTES,
    });

    await finishLesson();

    await expect
      .element(page.getByRole("link", { name: /^Next lesson/u }))
      .toHaveAttribute("href", "/learn/next");

    await expect.element(page.getByRole("link", { name: "Back to chapter" })).toBeVisible();
  });

  it("ends a replay with one Continue back where it was opened", async () => {
    const lesson = buildLesson([teachingStep("check")]);

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { startLesson: async () => startedRun({ replay: true }) }),
      lesson,
      routes: ROUTES,
    });

    await finishLesson();

    await expect
      .element(page.getByRole("link", { name: /^Continue/u }))
      .toHaveAttribute("href", "/chapter");

    expect(page.getByRole("link", { name: /^Next lesson/u }).elements()).toHaveLength(0);
    expect(page.getByRole("link", { name: "Back to chapter" }).elements()).toHaveLength(0);
  });

  it("leads a goal's first lesson to the plan the learner hasn't seen yet", async () => {
    const lesson = buildLesson([teachingStep("check")]);
    const local = localAdapters(lesson);

    const planReveal = {
      goalId: "goal-1",
      goalTitle: "Identify birds by their songs",
      planReady: true,
    };

    renderLessonPlayer({
      adapters: buildAdapters(lesson, {
        completeLesson: async (input) => {
          const outcome = await local.completeLesson(input);

          return outcome.status === "completed"
            ? { ...outcome, completion: { ...outcome.completion, planReveal } }
            : outcome;
        },
        startLesson: async () => startedRun({ replay: false }),
      }),
      lesson,
      routes: ROUTES,
    });

    await finishLesson();

    await expect.element(page.getByText("Your plan is ready")).toBeVisible();

    await expect
      .element(page.getByRole("link", { name: "See your plan" }))
      .toHaveAttribute("href", "/start/goal-1");

    expect(page.getByRole("link", { name: /^Next lesson/u }).elements()).toHaveLength(0);
    expect(page.getByRole("link", { name: "Back to chapter" }).elements()).toHaveLength(0);
  });
});

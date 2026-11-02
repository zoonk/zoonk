import { act } from "@testing-library/react";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { press } from "../_test-utils/activity-player";
import {
  acceptedAnswerCheck,
  buildAdapters,
  renderLessonPlayer,
} from "../_test-utils/render-lesson-player";
import { tap } from "../_test-utils/touch-screen";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep, teachingStep } from "../preview/preview-steps";

const RIGHT_TYPED = "It shows where the electron is likely to be";

describe("a written answer on a touch screen", () => {
  it("puts the keyboard away on Done, and as the check starts so the learner sees it checking", async () => {
    const typedAnswer = teachingStep("typedAnswer");
    const lesson = buildLesson([typedAnswer, teachingStep("summary")]);
    const pending = Promise.withResolvers<Awaited<ReturnType<LessonPlayerAdapters["checkStep"]>>>();

    const checkStep = vi
      .fn<LessonPlayerAdapters["checkStep"]>()
      .mockReturnValueOnce(pending.promise);

    renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

    const answer = page.getByRole("textbox", {
      name: "In your own words: why is the electron drawn as a cloud?",
    });

    await expect.element(answer).not.toHaveFocus();
    await tap(answer);
    await expect.element(answer).toHaveFocus();
    await press("Enter");
    await expect.element(answer).not.toHaveFocus();
    expect(checkStep).not.toHaveBeenCalled();

    await tap(answer);
    await userEvent.keyboard(RIGHT_TYPED);
    await press("Enter");
    await expect.element(page.getByRole("button", { name: "Checking" })).toBeDisabled();
    await expect.element(answer).not.toHaveFocus();

    const checked = await acceptedAnswerCheck(typedAnswer)(checkStep.mock.calls[0]![0]);

    await act(async () => {
      pending.resolve(checked);
      await pending.promise;
    });

    await expect.element(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
    await expect.element(answer).toHaveValue(RIGHT_TYPED);
  });

  it("puts the keyboard away on a number answer's Done too", async () => {
    const question = "How many electrons does a hydrogen atom have?";

    const lesson = buildLesson([
      contentStep("typedAnswer", {
        content: { ...playableStepContent.typedAnswer, acceptedAnswers: ["1"], question },
      }),
      teachingStep("summary"),
    ]);

    renderLessonPlayer({ lesson });
    const answer = page.getByRole("textbox", { name: question });

    await tap(answer);
    await expect.element(answer).toHaveFocus();
    await press("Enter");
    await expect.element(answer).not.toHaveFocus();
  });
});

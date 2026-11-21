import { type PlayableSpokenAnswerStep } from "@zoonk/core/lesson-player/playable-lesson";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { type PlayableLibraryStep } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { languageStep, spokenAnswerStep, teachingStep } from "../preview/preview-steps";

function withSentenceAudio(exercise: SerializedStep): SerializedStep {
  if (!exercise.sentence) {
    throw new Error("The listening step has no sentence");
  }

  return {
    ...exercise,
    sentence: { ...exercise.sentence, audioUrl: "https://audio.zoonk.test/sentence.mp3" },
  };
}

function listeningStep(): PlayableLibraryStep {
  const step = languageStep("listening");
  return { ...step, exercise: withSentenceAudio(step.exercise) };
}

function spokenStepWithListening(): PlayableSpokenAnswerStep {
  return {
    ...spokenAnswerStep(),
    listening: withSentenceAudio(languageStep("listening").exercise),
  };
}

function countPlays() {
  const plays = vi.fn();

  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function play(
    this: HTMLMediaElement,
  ) {
    plays();
    setTimeout(() => this.dispatchEvent(new Event("ended")), 0);
    return Promise.resolve();
  });

  return plays;
}

function openLesson(step: PlayableLibraryStep) {
  const lesson = buildLesson([step, teachingStep("summary")]);
  const adapters = buildAdapters(lesson, { gradeSpokenAnswer: vi.fn() });
  return renderLessonPlayer({ adapters, lesson });
}

describe("a learner who can't listen now", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads a listening sentence instead of hearing it, for the rest of the day", async () => {
    const plays = countPlays();
    const first = openLesson(listeningStep());

    await expect.element(page.getByText("What do you hear?")).toBeVisible();
    await expect.poll(() => plays.mock.calls.length).toBeGreaterThan(0);

    await page.getByRole("button", { name: "I can't listen now" }).click();
    await expect.element(page.getByText("How much is the rent?")).toBeVisible();
    await expect.element(page.getByText("What do you hear?")).not.toBeInTheDocument();
    await expect.element(page.getByRole("group", { name: "Word bank" })).toBeVisible();

    first.unmount();
    const playedBefore = plays.mock.calls.length;
    openLesson(listeningStep());

    await expect.element(page.getByText("How much is the rent?")).toBeVisible();
    expect(plays).toHaveBeenCalledTimes(playedBefore);

    await page.getByRole("button", { name: "I can listen now" }).click();
    await expect.element(page.getByText("What do you hear?")).toBeVisible();
    await expect.poll(() => plays.mock.calls.length).toBeGreaterThan(playedBefore);
  });

  it("types a spoken answer when it can't be said or heard", async () => {
    countPlays();
    openLesson(spokenStepWithListening());

    await page.getByRole("button", { name: "I can't talk now" }).click();
    const bank = page.getByRole("group", { name: "Word bank" });
    await bank.getByRole("button", { name: /^quanto$/iu }).click();

    await page.getByRole("button", { name: "I can't listen now" }).click();
    await expect.element(page.getByRole("textbox")).toBeVisible();
    await expect.element(page.getByRole("group", { name: "Word bank" })).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "I can talk now" })).toBeVisible();
  });
});

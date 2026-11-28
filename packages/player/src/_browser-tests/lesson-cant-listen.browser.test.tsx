import {
  type PlayableLanguageStep,
  type PlayableSpokenAnswerStep,
} from "@zoonk/core/lesson-player/playable-lesson";
import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { type PlayableLibraryStep } from "../lesson/lesson-player-types";
import { CANT_LISTEN_TODAY, setChosenToday } from "../lesson/use-today-choice";
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

function listeningStep(): PlayableLanguageStep {
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

  it("finds the way out under the question and Play in the bar, as on a speaking screen", async () => {
    countPlays();
    openLesson(spokenStepWithListening());

    await page.getByRole("button", { name: "I can't talk now" }).click();
    const wayOut = page.getByRole("button", { name: "I can't listen now" }).element();
    const bank = page.getByRole("group", { name: "Word bank" }).element();
    const play = page.getByRole("button", { name: "Play pronunciation" }).element();

    expect(wayOut.getBoundingClientRect().bottom).toBeLessThan(bank.getBoundingClientRect().top);
    expect(play.closest("[data-slot=bottom-bar]")).not.toBeNull();

    await page.getByRole("button", { name: "I can't listen now" }).click();

    await expect
      .element(page.getByRole("status").filter({ hasText: "Speaking is off for today." }))
      .toBeVisible();

    await expect
      .element(page.getByRole("button", { name: "Play pronunciation" }))
      .not.toBeInTheDocument();
  });

  it("moves past a sentence that is its own answer instead of showing it", async () => {
    countPlays();
    const step = listeningStep();
    const sentence = step.exercise.sentence;

    if (!sentence) {
      throw new Error("The listening step has no sentence");
    }

    openLesson({
      ...step,
      exercise: {
        ...step.exercise,
        sentence: { ...sentence, readsItself: true, translation: sentence.sentence },
      },
    });

    await page.getByRole("button", { name: "I can't listen now" }).click();

    await expect.element(page.getByText("What do you hear?")).not.toBeInTheDocument();
    await expect.element(page.getByText("How much is the rent?")).not.toBeInTheDocument();
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

  it("leaves a spoken screen out once it can't be said or heard, until speaking is turned back on", async () => {
    countPlays();
    openLesson(spokenStepWithListening());

    await page.getByRole("button", { name: "I can't talk now" }).click();
    const bank = page.getByRole("group", { name: "Word bank" });
    await bank.getByRole("button", { name: /^quanto$/iu }).click();

    await page.getByRole("button", { name: "I can't listen now" }).click();

    await expect
      .element(page.getByRole("status").filter({ hasText: "Speaking is off for today." }))
      .toBeVisible();

    await expect.element(page.getByText("How much is the rent?")).not.toBeInTheDocument();
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Turn back on" }).click();
    await expect.element(page.getByRole("button", { name: "Record" })).toBeVisible();
  });

  it("keeps a spoken step answered by listening quiet when the learner comes back after turning listening off", async () => {
    const plays = countPlays();
    openLesson(spokenStepWithListening());

    await page.getByRole("button", { name: "I can't talk now" }).click();
    const bank = page.getByRole("group", { name: "Word bank" });

    for (const word of [/^quanto$/iu, /^é$/iu, /^o$/iu, /^aluguel\?$/iu]) {
      // oxlint-disable-next-line no-await-in-loop -- The words go in one at a time, in order.
      await bank.getByRole("button", { name: word }).click();
    }

    await page.getByRole("button", { name: /^Check/u }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();

    setChosenToday(CANT_LISTEN_TODAY, true);
    const playedBefore = plays.mock.calls.length;
    await page.getByRole("button", { name: "Previous screen" }).click();

    await expect.element(page.getByText("How much is the rent?")).toBeVisible();
    expect(plays).toHaveBeenCalledTimes(playedBefore);
  });
});

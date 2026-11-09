import { Activity } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "../_test-utils/render";
import {
  buildAdapters,
  lessonPlayerElement,
  renderLessonPlayer,
  startedRun,
} from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

const RIGHT_OPTION = "Where the electron is most likely to be found";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

function clockServer(delivered: boolean[] = []) {
  return vi.fn<NonNullable<LessonPlayerAdapters["updateLessonClock"]>>(() =>
    Promise.resolve(delivered.shift() ?? true),
  );
}

function transitions(updateLessonClock: ReturnType<typeof clockServer>) {
  return updateLessonClock.mock.calls.map(([input]) => input);
}

async function answerRight() {
  await page.getByRole("radio", { name: RIGHT_OPTION }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect.element(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
}

describe("lesson clock", () => {
  afterEach(() => {
    Reflect.deleteProperty(document, "visibilityState");
    localStorage.clear();
  });

  it("pauses while the learner is away or closes the lesson, and runs again when they're back", async () => {
    const lesson = buildLesson([teachingStep("check")]);
    const clockId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    const updateLessonClock = clockServer();

    const { unmount } = renderLessonPlayer({
      adapters: buildAdapters(lesson, {
        startLesson: () => Promise.resolve(startedRun({ clockId, runId })),
        updateLessonClock,
      }),
      lesson,
    });

    setVisibility("hidden");
    await expect.poll(() => transitions(updateLessonClock)).toHaveLength(1);
    setVisibility("visible");
    await expect.poll(() => transitions(updateLessonClock)).toHaveLength(2);
    unmount();

    expect(transitions(updateLessonClock)).toStrictEqual([
      { clockId, runId, sequence: 1, state: "paused" },
      { clockId, runId, sequence: 2, state: "running" },
      { clockId, runId, sequence: 3, state: "paused" },
    ]);
  });

  it("resumes a lesson restored by Back after Activity hides it", async () => {
    const lesson = buildLesson([teachingStep("check")]);
    const clockId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    const updateLessonClock = clockServer();
    const startLesson = vi.fn(() => Promise.resolve(startedRun({ clockId, runId })));

    const player = lessonPlayerElement({
      adapters: buildAdapters(lesson, { startLesson, updateLessonClock }),
      lesson,
    });

    const view = render(<Activity mode="visible">{player}</Activity>);
    await expect.poll(() => startLesson.mock.calls.length).toBe(1);
    await expect.element(page.getByRole("radio", { name: RIGHT_OPTION })).toBeVisible();
    view.rerender(<Activity mode="hidden">{player}</Activity>);

    await expect
      .poll(() => transitions(updateLessonClock))
      .toStrictEqual([{ clockId, runId, sequence: 1, state: "paused" }]);

    view.rerender(<Activity mode="visible">{player}</Activity>);
    await expect.element(page.getByRole("radio", { name: RIGHT_OPTION })).toBeVisible();

    await expect
      .poll(() => transitions(updateLessonClock))
      .toStrictEqual([
        { clockId, runId, sequence: 1, state: "paused" },
        { clockId, runId, sequence: 2, state: "running" },
      ]);

    expect(startLesson).toHaveBeenCalledOnce();
  });

  it("pauses the clock of a start that answers after the learner closed the lesson", async () => {
    const lesson = buildLesson([teachingStep("check")]);
    const clockId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    const updateLessonClock = clockServer();
    const started = Promise.withResolvers<ReturnType<typeof startedRun>>();
    const startLesson = vi.fn(() => started.promise);

    const { unmount } = renderLessonPlayer({
      adapters: buildAdapters(lesson, { startLesson, updateLessonClock }),
      lesson,
    });

    await expect.poll(() => startLesson.mock.calls.length).toBe(1);
    unmount();
    started.resolve(startedRun({ clockId, runId }));

    await expect
      .poll(() => transitions(updateLessonClock))
      .toStrictEqual([{ clockId, runId, sequence: 1, state: "paused" }]);
  });

  it("leaves a lesson outside a study block without a clock", async () => {
    const lesson = buildLesson([teachingStep("check")]);
    const updateLessonClock = clockServer();
    const adapters = buildAdapters(lesson, { updateLessonClock });

    const { unmount } = renderLessonPlayer({ adapters, lesson });

    await answerRight();
    await expect.poll(() => vi.mocked(adapters.checkStep).mock.calls.length).toBe(1);
    setVisibility("hidden");
    setVisibility("visible");
    unmount();

    expect(updateLessonClock).not.toHaveBeenCalled();
  });

  it("sends a change that didn't get through again under its sequence when the connection returns", async () => {
    const lesson = buildLesson([teachingStep("check")]);
    const clockId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    const updateLessonClock = clockServer([true, false]);

    renderLessonPlayer({
      adapters: buildAdapters(lesson, {
        startLesson: () => Promise.resolve(startedRun({ clockId, runId })),
        updateLessonClock,
      }),
      lesson,
    });

    setVisibility("hidden");
    await expect.poll(() => transitions(updateLessonClock)).toHaveLength(1);
    setVisibility("visible");
    await expect.poll(() => transitions(updateLessonClock)).toHaveLength(2);
    globalThis.dispatchEvent(new Event("online"));
    await expect.poll(() => transitions(updateLessonClock)).toHaveLength(3);
    globalThis.dispatchEvent(new Event("online"));

    expect(transitions(updateLessonClock)).toStrictEqual([
      { clockId, runId, sequence: 1, state: "paused" },
      { clockId, runId, sequence: 2, state: "running" },
      { clockId, runId, sequence: 2, state: "running" },
    ]);
  });

  it("counts again from the first change on the clock a new start gives", async () => {
    const lesson = buildLesson([teachingStep("check"), teachingStep("explanation")]);
    const runId = crypto.randomUUID();
    const [firstClock, secondClock] = [crypto.randomUUID(), crypto.randomUUID()];
    const updateLessonClock = clockServer();

    const startLesson = vi
      .fn<LessonPlayerAdapters["startLesson"]>()
      .mockResolvedValueOnce(startedRun({ clockId: firstClock, runId }))
      .mockResolvedValue(startedRun({ clockId: secondClock, runId }));

    const completeLesson = vi
      .fn<LessonPlayerAdapters["completeLesson"]>()
      .mockResolvedValue({ status: "incomplete" });

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { completeLesson, startLesson, updateLessonClock }),
      lesson,
    });

    setVisibility("hidden");
    await expect.poll(() => transitions(updateLessonClock)).toHaveLength(1);
    setVisibility("visible");
    await answerRight();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.poll(() => startLesson.mock.calls.length).toBe(2);
    await expect.element(page.getByRole("radio", { name: RIGHT_OPTION })).toBeVisible();
    setVisibility("hidden");
    await expect.poll(() => transitions(updateLessonClock)).toHaveLength(3);

    expect(transitions(updateLessonClock)).toStrictEqual([
      { clockId: firstClock, runId, sequence: 1, state: "paused" },
      { clockId: firstClock, runId, sequence: 2, state: "running" },
      { clockId: secondClock, runId, sequence: 1, state: "paused" },
    ]);
  });
});

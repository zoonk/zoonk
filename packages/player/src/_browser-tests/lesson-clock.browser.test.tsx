import { act } from "@testing-library/react";
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
    Promise.resolve((delivered.shift() ?? true) ? { status: "updated" } : null),
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
    vi.useRealTimers();
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

  it.each(["Activity", "visibility"])(
    "restarts an ignored running clock once when returning through %s",
    async (through) => {
      const lesson = buildLesson([teachingStep("check")]);
      const runId = crypto.randomUUID();
      const [firstClock, secondClock] = [crypto.randomUUID(), crypto.randomUUID()];
      const updateLessonClock = clockServer().mockResolvedValue({ status: "ignored" });

      const startLesson = vi
        .fn<LessonPlayerAdapters["startLesson"]>()
        .mockResolvedValueOnce(startedRun({ clockId: firstClock, runId }))
        .mockResolvedValue(startedRun({ clockId: secondClock, runId }));

      const player = lessonPlayerElement({
        adapters: buildAdapters(lesson, { startLesson, updateLessonClock }),
        lesson,
      });

      const view = render(<Activity mode="visible">{player}</Activity>);
      await expect.element(page.getByRole("radio", { name: RIGHT_OPTION })).toBeVisible();

      if (through === "Activity") {
        view.rerender(<Activity mode="hidden">{player}</Activity>);
      } else {
        setVisibility("hidden");
      }

      await expect.poll(() => transitions(updateLessonClock)).toHaveLength(1);
      expect(startLesson).toHaveBeenCalledOnce();

      if (through === "Activity") {
        view.rerender(<Activity mode="visible">{player}</Activity>);
      } else {
        setVisibility("visible");
      }

      await expect.poll(() => startLesson.mock.calls).toStrictEqual([[undefined], [{ runId }]]);
      setVisibility("visible");
      globalThis.dispatchEvent(new Event("online"));
      setVisibility("hidden");

      await expect
        .poll(() => transitions(updateLessonClock))
        .toStrictEqual([
          { clockId: firstClock, runId, sequence: 1, state: "paused" },
          { clockId: firstClock, runId, sequence: 2, state: "running" },
          { clockId: secondClock, runId, sequence: 1, state: "paused" },
        ]);

      expect(startLesson).toHaveBeenCalledTimes(2);
    },
  );

  it("sends an ignored running change again when its restart didn't get through", async () => {
    const lesson = buildLesson([teachingStep("check")]);
    const runId = crypto.randomUUID();
    const [firstClock, secondClock] = [crypto.randomUUID(), crypto.randomUUID()];

    const updateLessonClock = clockServer().mockImplementation((input) =>
      Promise.resolve({ status: input.state === "running" ? "ignored" : "updated" }),
    );

    const startLesson = vi
      .fn<LessonPlayerAdapters["startLesson"]>()
      .mockResolvedValueOnce(startedRun({ clockId: firstClock, runId }))
      .mockResolvedValueOnce({ reason: "failed" })
      .mockResolvedValue(startedRun({ clockId: secondClock, runId }));

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { startLesson, updateLessonClock }),
      lesson,
    });

    await expect.element(page.getByRole("radio", { name: RIGHT_OPTION })).toBeVisible();
    setVisibility("hidden");
    await expect.poll(() => transitions(updateLessonClock)).toHaveLength(1);
    setVisibility("visible");
    await expect.poll(() => startLesson.mock.calls).toHaveLength(2);
    globalThis.dispatchEvent(new Event("online"));
    await expect.poll(() => startLesson.mock.calls).toHaveLength(3);
    setVisibility("hidden");
    await expect.poll(() => transitions(updateLessonClock)).toHaveLength(4);

    expect(transitions(updateLessonClock)).toStrictEqual([
      { clockId: firstClock, runId, sequence: 1, state: "paused" },
      { clockId: firstClock, runId, sequence: 2, state: "running" },
      { clockId: firstClock, runId, sequence: 2, state: "running" },
      { clockId: secondClock, runId, sequence: 1, state: "paused" },
    ]);
  });

  it.each(["Activity", "visibility"])(
    "does not restart an ignored running clock after leaving through %s again",
    async (through) => {
      const lesson = buildLesson([teachingStep("check")]);
      const runId = crypto.randomUUID();
      const [firstClock, secondClock] = [crypto.randomUUID(), crypto.randomUUID()];
      const running = Promise.withResolvers<{ status: "ignored" }>();

      const updateLessonClock = clockServer().mockImplementation((input) =>
        input.state === "running" ? running.promise : Promise.resolve({ status: "updated" }),
      );

      const startLesson = vi
        .fn<LessonPlayerAdapters["startLesson"]>()
        .mockResolvedValueOnce(startedRun({ clockId: firstClock, runId }))
        .mockResolvedValue(startedRun({ clockId: secondClock, runId }));

      const player = lessonPlayerElement({
        adapters: buildAdapters(lesson, { startLesson, updateLessonClock }),
        lesson,
      });

      const view = render(<Activity mode="visible">{player}</Activity>);
      await expect.element(page.getByRole("radio", { name: RIGHT_OPTION })).toBeVisible();

      function show(visible: boolean) {
        if (through === "Activity") {
          view.rerender(<Activity mode={visible ? "visible" : "hidden"}>{player}</Activity>);
        } else {
          setVisibility(visible ? "visible" : "hidden");
        }
      }

      show(false);
      await expect.poll(() => transitions(updateLessonClock)).toHaveLength(1);
      show(true);
      await expect.poll(() => transitions(updateLessonClock)).toHaveLength(2);
      show(false);
      await expect.poll(() => transitions(updateLessonClock)).toHaveLength(3);

      await act(async () => {
        running.resolve({ status: "ignored" });
        await running.promise;
      });

      expect(startLesson).toHaveBeenCalledOnce();

      expect(transitions(updateLessonClock)).toStrictEqual([
        { clockId: firstClock, runId, sequence: 1, state: "paused" },
        { clockId: firstClock, runId, sequence: 2, state: "running" },
        { clockId: firstClock, runId, sequence: 3, state: "paused" },
      ]);
    },
  );

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

  it.each([
    { moment: "answer", steps: [teachingStep("check")], take: answerRight },
    {
      moment: "step",
      steps: [teachingStep("explanation"), teachingStep("check")],
      take: () => page.getByRole("button", { name: /^Next/u }).click(),
    },
  ])(
    "sends a change that didn't get through again at the learner's next $moment",
    async ({ steps, take }) => {
      const lesson = buildLesson(steps);
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
      await take();

      await expect
        .poll(() => transitions(updateLessonClock))
        .toStrictEqual([
          { clockId, runId, sequence: 1, state: "paused" },
          { clockId, runId, sequence: 2, state: "running" },
          { clockId, runId, sequence: 2, state: "running" },
        ]);
    },
  );

  it("finishes only once the clock change Continue sends again gets through", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const lesson = buildLesson([teachingStep("check")]);
    const clockId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    const delivered = [true, false, false];
    const resent = Promise.withResolvers<{ status: "updated" }>();

    const updateLessonClock = clockServer().mockImplementation(() =>
      delivered.length > 0
        ? Promise.resolve(delivered.shift() ? { status: "updated" } : null)
        : resent.promise,
    );

    const adapters = buildAdapters(lesson, {
      startLesson: () => Promise.resolve(startedRun({ clockId, runId })),
      updateLessonClock,
    });

    renderLessonPlayer({ adapters, lesson });

    await expect.element(page.getByRole("radio", { name: RIGHT_OPTION })).toBeVisible();
    setVisibility("hidden");
    await expect.poll(() => transitions(updateLessonClock)).toHaveLength(1);
    setVisibility("visible");
    await expect.poll(() => transitions(updateLessonClock)).toHaveLength(2);
    await answerRight();
    await expect.poll(() => transitions(updateLessonClock)).toHaveLength(3);
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.poll(() => transitions(updateLessonClock)).toHaveLength(4);

    await vi.advanceTimersByTimeAsync(1000);
    expect(adapters.completeLesson).not.toHaveBeenCalled();

    resent.resolve({ status: "updated" });
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    expect(adapters.completeLesson).toHaveBeenCalledOnce();

    expect(transitions(updateLessonClock)).toStrictEqual([
      { clockId, runId, sequence: 1, state: "paused" },
      { clockId, runId, sequence: 2, state: "running" },
      { clockId, runId, sequence: 2, state: "running" },
      { clockId, runId, sequence: 2, state: "running" },
    ]);
  });

  it("finishes only once every clock change sent while it waits has landed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const lesson = buildLesson([teachingStep("check")]);
    const clockId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    const resumed = Promise.withResolvers<{ status: "updated" }>();
    const resumedAgain = Promise.withResolvers<{ status: "updated" }>();

    const updateLessonClock = clockServer().mockImplementation(({ sequence }) => {
      if (sequence === 2) {
        return resumed.promise;
      }

      return sequence === 4 ? resumedAgain.promise : Promise.resolve({ status: "updated" });
    });

    const adapters = buildAdapters(lesson, {
      startLesson: () => Promise.resolve(startedRun({ clockId, runId })),
      updateLessonClock,
    });

    renderLessonPlayer({ adapters, lesson });

    await expect.element(page.getByRole("radio", { name: RIGHT_OPTION })).toBeVisible();
    setVisibility("hidden");
    setVisibility("visible");
    await answerRight();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await vi.advanceTimersByTimeAsync(1000);
    setVisibility("hidden");
    setVisibility("visible");
    resumed.resolve({ status: "updated" });

    await vi.advanceTimersByTimeAsync(1000);
    expect(adapters.completeLesson).not.toHaveBeenCalled();

    resumedAgain.resolve({ status: "updated" });
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    expect(transitions(updateLessonClock)).toStrictEqual([
      { clockId, runId, sequence: 1, state: "paused" },
      { clockId, runId, sequence: 2, state: "running" },
      { clockId, runId, sequence: 3, state: "paused" },
      { clockId, runId, sequence: 4, state: "running" },
    ]);
  });

  it("finishes only once the clock a restart gives has its change too", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const lesson = buildLesson([teachingStep("check")]);
    const runId = crypto.randomUUID();
    const [firstClock, secondClock] = [crypto.randomUUID(), crypto.randomUUID()];
    const restarted = Promise.withResolvers<ReturnType<typeof startedRun>>();
    const freshPause = Promise.withResolvers<{ status: "updated" }>();

    const updateLessonClock = clockServer().mockImplementation((input) =>
      input.clockId === secondClock
        ? freshPause.promise
        : Promise.resolve({ status: input.state === "running" ? "ignored" : "updated" }),
    );

    const startLesson = vi
      .fn<LessonPlayerAdapters["startLesson"]>()
      .mockResolvedValueOnce(startedRun({ clockId: firstClock, runId }))
      .mockReturnValue(restarted.promise);

    const adapters = buildAdapters(lesson, { startLesson, updateLessonClock });
    renderLessonPlayer({ adapters, lesson });

    await expect.element(page.getByRole("radio", { name: RIGHT_OPTION })).toBeVisible();
    setVisibility("hidden");
    setVisibility("visible");
    await expect.poll(() => startLesson.mock.calls).toHaveLength(2);
    await answerRight();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await vi.advanceTimersByTimeAsync(1000);
    setVisibility("hidden");
    restarted.resolve(startedRun({ clockId: secondClock, runId }));
    await expect.poll(() => transitions(updateLessonClock)).toHaveLength(4);

    await vi.advanceTimersByTimeAsync(1000);
    expect(adapters.completeLesson).not.toHaveBeenCalled();

    freshPause.resolve({ status: "updated" });
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    expect(transitions(updateLessonClock)).toStrictEqual([
      { clockId: firstClock, runId, sequence: 1, state: "paused" },
      { clockId: firstClock, runId, sequence: 2, state: "running" },
      { clockId: firstClock, runId, sequence: 3, state: "paused" },
      { clockId: secondClock, runId, sequence: 1, state: "paused" },
    ]);
  });

  it("sends nothing more on the clock once the lesson is finished", async () => {
    const lesson = buildLesson([teachingStep("check")]);
    const clockId = crypto.randomUUID();
    const runId = crypto.randomUUID();
    const updateLessonClock = clockServer().mockResolvedValue({ status: "ignored" });

    const startLesson = vi
      .fn<LessonPlayerAdapters["startLesson"]>()
      .mockResolvedValueOnce(startedRun({ clockId, runId }))
      .mockResolvedValue({ reason: "notFound" });

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { startLesson, updateLessonClock }),
      lesson,
    });

    await answerRight();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    setVisibility("hidden");
    setVisibility("visible");
    globalThis.dispatchEvent(new Event("online"));

    expect(updateLessonClock).not.toHaveBeenCalled();
    expect(startLesson).toHaveBeenCalledOnce();
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

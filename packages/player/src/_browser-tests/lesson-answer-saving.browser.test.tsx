import { type PlayableLibraryLesson } from "@zoonk/core/lesson-player/playable-lesson";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { TestIntl } from "../_test-utils/render";
import {
  LEARNER_ID,
  buildAdapters,
  lessonPlayerElement,
  renderLessonPlayer,
  startedRun,
} from "../_test-utils/render-lesson-player";
import { LESSON_PRIMARY_ID } from "../lesson/_utils/lesson-focus";
import { keepUnsentAnswer } from "../lesson/_utils/unsent-answers";
import {
  type LessonCheckOutcome,
  type LessonPlayerAdapters,
  type LessonRunAnswers,
} from "../lesson/lesson-player-types";
import { CHECK_BOUNDS } from "../lesson/use-step-grading";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

const RIGHT_OPTION = "Where the electron is most likely to be found";
const WRONG_OPTION = "The electron's exact path";
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u;
const MS_PER_DAY = 86_400_000;
const NOT_SAVED = "Not saved yet";
const EXPLANATION = "A cloud, not a little ball";
const QUESTION = 'What does the electron "cloud" show?';

async function answer(option: string, expected: string) {
  await page.getByRole("radio", { name: option }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect.element(page.getByRole("status").filter({ hasText: expected })).toBeVisible();
}

function notSaved() {
  return page.getByRole("button", { name: NOT_SAVED });
}

function stepIdsOf(lesson: PlayableLibraryLesson, kind: string): string[] {
  return lesson.steps.filter((step) => step.kind === kind).map((step) => step.id);
}

/** Like the real server, it records a resent attempt once and reports saved answers when a run starts. */
function fakeServer(lesson: PlayableLibraryLesson) {
  const saved = buildAdapters(lesson).checkStep;
  const answers = new Map<string, LessonRunAnswers[number]>();

  const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>(async (input) => {
    const outcome = await saved(input);

    if (outcome.status === "checked" && !answers.has(input.attemptId)) {
      answers.set(input.attemptId, {
        answeredAt: new Date().toISOString(),
        isCorrect: outcome.result.isCorrect,
        stepId: input.stepId,
      });
    }

    return outcome;
  });

  const runId = crypto.randomUUID();

  const startLesson = vi.fn<LessonPlayerAdapters["startLesson"]>(() =>
    Promise.resolve(startedRun({ answers: [...answers.values()], runId })),
  );

  return { checkStep, startLesson };
}

function unsentKeys(): string[] {
  return Object.keys(localStorage).filter((key) => key.startsWith("lesson-unsent:"));
}

describe("saving answers", () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("sends an answer that didn't get through again under the same id", async () => {
    const lesson = buildLesson([teachingStep("check")]);
    const saved = buildAdapters(lesson).checkStep;

    const checkStep = vi
      .fn<LessonPlayerAdapters["checkStep"]>()
      .mockResolvedValueOnce({ status: "failed" })
      .mockImplementation(saved);

    renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

    await answer(RIGHT_OPTION, "Correct!");
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    const [first, retry] = checkStep.mock.calls.map(([input]) => input.attemptId);

    expect(checkStep).toHaveBeenCalledTimes(2);
    expect(first).toMatch(UUID);
    expect(retry).toBe(first);
  });

  it("keeps a newer answer's result when the server's word on an earlier one comes late", async () => {
    const lesson = buildLesson([teachingStep("check")]);
    const late = Promise.withResolvers<LessonCheckOutcome>();

    const checkStep = vi
      .fn<LessonPlayerAdapters["checkStep"]>()
      .mockReturnValueOnce(late.promise)
      .mockResolvedValue({ status: "failed" });

    renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

    await answer(WRONG_OPTION, "Not quite");
    await page.getByRole("button", { name: /^Continue/u }).click();

    await answer(RIGHT_OPTION, "Correct!");

    late.resolve({
      result: {
        checked: true,
        correctAnswer: RIGHT_OPTION,
        corrections: [],
        expected: null,
        feedback: null,
        isCorrect: false,
        keyPoints: null,
        nextReviewAt: new Date(Date.now() + 3 * MS_PER_DAY).toISOString(),
        savedMistake: true,
        score: null,
        spelling: null,
      },
      status: "checked",
    });

    await expect.poll(() => checkStep.mock.calls.length).toBe(2);

    const [first, second] = checkStep.mock.calls.map(([input]) => input.attemptId);
    expect(second).not.toBe(first);

    await expect.element(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();

    await expect
      .element(page.getByText("Saved to your mistakes", { exact: false }))
      .not.toBeInTheDocument();

    await expect
      .element(page.getByText("This idea comes back", { exact: false }))
      .not.toBeInTheDocument();
  });

  it("saves a screen's answers in the order they were given", async () => {
    const lesson = buildLesson([teachingStep("check")]);
    const saved = buildAdapters(lesson).checkStep;
    const slow = Promise.withResolvers<null>();

    const checkStep = vi
      .fn<LessonPlayerAdapters["checkStep"]>()
      .mockImplementationOnce(async (input) => {
        await slow.promise;
        return saved(input);
      })
      .mockImplementation(saved);

    const adapters = buildAdapters(lesson, { checkStep });
    renderLessonPlayer({ adapters, lesson });

    await answer(WRONG_OPTION, "Not quite");
    await page.getByRole("button", { name: /^Continue/u }).click();
    await answer(RIGHT_OPTION, "Correct!");

    expect(checkStep).toHaveBeenCalledOnce();

    slow.resolve(null);
    await expect.poll(() => checkStep.mock.calls.length).toBe(2);

    const kinds = checkStep.mock.calls.map(([input]) =>
      input.answer.kind === "check" ? input.answer.optionId : null,
    );

    expect(kinds).toStrictEqual(["path", "likely"]);

    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
  });

  it("sends a screen's save that didn't get through again before the screen's next answer", async () => {
    const lesson = buildLesson([teachingStep("check")]);
    const saved = buildAdapters(lesson).checkStep;

    const checkStep = vi
      .fn<LessonPlayerAdapters["checkStep"]>()
      .mockResolvedValueOnce({ status: "failed" })
      .mockImplementation(saved);

    renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

    await answer(WRONG_OPTION, "Not quite");
    await page.getByRole("button", { name: /^Continue/u }).click();
    await answer(RIGHT_OPTION, "Correct!");
    await expect.poll(() => checkStep.mock.calls.length).toBe(3);

    const sent = checkStep.mock.calls.map(([input]) => ({
      attemptId: input.attemptId,
      option: input.answer.kind === "check" ? input.answer.optionId : null,
    }));

    expect(sent.map((save) => save.option)).toStrictEqual(["path", "path", "likely"]);
    expect(sent[1]?.attemptId).toBe(sent[0]?.attemptId);
    expect(sent[2]?.attemptId).not.toBe(sent[0]?.attemptId);

    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    expect(checkStep).toHaveBeenCalledTimes(3);
  });

  it("finishes only once a grade the screen stopped waiting for has settled", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const lesson = buildLesson([teachingStep("typedAnswer"), teachingStep("summary")]);
    const late = Promise.withResolvers<LessonCheckOutcome>();

    const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>().mockReturnValueOnce(late.promise);

    const adapters = buildAdapters(lesson, { checkStep });
    renderLessonPlayer({ adapters, lesson });

    await page
      .getByRole("textbox", { name: "In your own words: why is the electron drawn as a cloud?" })
      .fill("Because it's probably around there");

    await page.getByRole("button", { name: /^Check/u }).click();
    await vi.advanceTimersByTimeAsync(CHECK_BOUNDS.timeoutMs.typed + 1000);

    await expect
      .element(page.getByText("We couldn't check your answer this time. Try again."))
      .toBeVisible();

    await page.getByRole("button", { name: "I don't know yet" }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await vi.advanceTimersByTimeAsync(1000);
    expect(adapters.completeLesson).not.toHaveBeenCalled();

    late.resolve({ status: "refused" });
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    expect(adapters.completeLesson).toHaveBeenCalledOnce();
  });

  it("says answers aren't saved yet until the connection comes back and they go through", async () => {
    const lesson = buildLesson([teachingStep("check"), teachingStep("explanation")]);
    const saved = buildAdapters(lesson).checkStep;
    const connection = { online: false };

    const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>((input) =>
      connection.online ? saved(input) : Promise.resolve({ status: "failed" }),
    );

    renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

    await answer(RIGHT_OPTION, "Correct!");
    await expect.element(notSaved()).toBeVisible();

    await expect
      .element(page.getByRole("status").filter({ hasText: NOT_SAVED }))
      .toBeInTheDocument();

    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: EXPLANATION })).toBeVisible();
    await expect.poll(() => checkStep.mock.calls.length).toBe(2);
    await expect.element(notSaved()).toBeVisible();

    await notSaved().click();

    await expect
      .element(
        page.getByText(
          "Some answers aren't saved yet. We'll keep trying while this lesson is open.",
        ),
      )
      .toBeVisible();

    connection.online = true;
    globalThis.dispatchEvent(new Event("online"));

    await expect.element(notSaved()).not.toBeInTheDocument();
    expect(new Set(checkStep.mock.calls.map(([input]) => input.attemptId)).size).toBe(1);
    expect(unsentKeys()).toStrictEqual([]);
  });

  it.each([
    ["the tab shows again", () => document.dispatchEvent(new Event("visibilitychange"))],
    ["the learner moves on", () => page.getByRole("button", { name: /^Next/u }).click()],
  ])("sends an answer that didn't get through again when %s", async (_, trigger) => {
    const lesson = buildLesson([
      teachingStep("check"),
      teachingStep("explanation"),
      teachingStep("explanation"),
    ]);

    const saved = buildAdapters(lesson).checkStep;

    const checkStep = vi
      .fn<LessonPlayerAdapters["checkStep"]>()
      .mockResolvedValueOnce({ status: "failed" })
      .mockResolvedValueOnce({ status: "failed" })
      .mockImplementation(saved);

    renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

    await answer(RIGHT_OPTION, "Correct!");
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.poll(() => checkStep.mock.calls.length).toBe(2);
    await expect.element(notSaved()).toBeVisible();

    await trigger();

    await expect.element(notSaved()).not.toBeInTheDocument();
    expect(checkStep).toHaveBeenCalledTimes(3);
    expect(new Set(checkStep.mock.calls.map(([input]) => input.attemptId)).size).toBe(1);
  });

  it("sends an earlier screen's answer again once another answer gets through", async () => {
    const lesson = buildLesson([
      teachingStep("check"),
      teachingStep("explanation"),
      teachingStep("check"),
    ]);

    const [first, second] = stepIdsOf(lesson, "check");
    const saved = buildAdapters(lesson).checkStep;
    const connection = { online: false };

    const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>((input) =>
      connection.online ? saved(input) : Promise.resolve({ status: "failed" }),
    );

    renderLessonPlayer({ adapters: buildAdapters(lesson, { checkStep }), lesson });

    await answer(WRONG_OPTION, "Not quite");
    await page.getByRole("button", { name: /^Continue/u }).click();
    await page.getByRole("button", { name: /^Next/u }).click();
    await expect.element(notSaved()).toBeVisible();

    connection.online = true;
    await answer(RIGHT_OPTION, "Correct!");

    await expect.element(notSaved()).not.toBeInTheDocument();

    const [missed] = checkStep.mock.calls.map(([input]) => input);
    const sent = checkStep.mock.calls.slice(-2).map(([input]) => input.stepId);

    expect(sent).toStrictEqual([second, first]);
    expect(checkStep.mock.calls.at(-1)?.[0].attemptId).toBe(missed?.attemptId);
  });

  it("opens again after an answer cut off by leaving, and sends it before the run starts", async () => {
    const lesson = buildLesson([
      teachingStep("check"),
      teachingStep("explanation"),
      teachingStep("check"),
    ]);

    const server = fakeServer(lesson);

    const cutOff = vi.fn<LessonPlayerAdapters["checkStep"]>(
      () => Promise.withResolvers<LessonCheckOutcome>().promise,
    );

    const left = renderLessonPlayer({
      adapters: buildAdapters(lesson, { checkStep: cutOff, startLesson: server.startLesson }),
      lesson,
    });

    await answer(WRONG_OPTION, "Not quite");
    await expect.poll(() => cutOff.mock.calls.length).toBe(1);
    left.unmount();
    server.startLesson.mockClear();

    renderLessonPlayer({ adapters: buildAdapters(lesson, server), lesson });

    await expect.element(page.getByRole("heading", { name: EXPLANATION })).toBeVisible();
    await expect.poll(() => server.startLesson.mock.calls.length).toBe(1);

    expect(server.checkStep.mock.invocationCallOrder[0]).toBeLessThan(
      server.startLesson.mock.invocationCallOrder[0] ?? 0,
    );

    expect(server.checkStep.mock.calls[0]?.[0]).toStrictEqual(cutOff.mock.calls[0]?.[0]);
    expect(unsentKeys()).toStrictEqual([]);

    await page.getByRole("button", { name: /^Next/u }).click();
    await answer(RIGHT_OPTION, "Correct!");
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByRole("heading", { name: QUESTION })).toBeVisible();
    await expect.element(page.getByRole("radio", { name: WRONG_OPTION })).not.toBeChecked();
  });

  it("keeps an answer the server turned away for an ended session, for that learner only", async () => {
    const lesson = buildLesson([
      teachingStep("check"),
      teachingStep("explanation"),
      teachingStep("check"),
    ]);

    const sessionEnded = vi
      .fn<LessonPlayerAdapters["checkStep"]>()
      .mockResolvedValue({ status: "failed" });

    const ended = renderLessonPlayer({
      adapters: buildAdapters(lesson, { checkStep: sessionEnded }),
      lesson,
    });

    await answer(RIGHT_OPTION, "Correct!");
    await expect.element(notSaved()).toBeVisible();
    ended.unmount();

    const someoneElse = buildAdapters(lesson);

    const other = renderLessonPlayer({
      adapters: someoneElse,
      lesson,
      viewer: { learnerId: "someone-else" },
    });

    await expect.element(page.getByRole("radio", { name: RIGHT_OPTION })).toBeVisible();
    expect(someoneElse.checkStep).not.toHaveBeenCalled();
    other.unmount();

    const server = fakeServer(lesson);
    renderLessonPlayer({ adapters: buildAdapters(lesson, server), lesson });

    await expect.element(page.getByRole("heading", { name: EXPLANATION })).toBeVisible();
    await expect.poll(() => server.checkStep.mock.calls.length).toBe(1);

    expect(server.checkStep.mock.calls[0]?.[0].attemptId).toBe(
      sessionEnded.mock.calls[0]?.[0].attemptId,
    );
  });

  it("goes back to an answer the server refused when it was sent again, as the lesson ends", async () => {
    const lesson = buildLesson([teachingStep("check"), teachingStep("explanation")]);
    const finished = buildAdapters(lesson).completeLesson;

    const checkStep = vi
      .fn<LessonPlayerAdapters["checkStep"]>()
      .mockResolvedValueOnce({ status: "failed" })
      .mockResolvedValueOnce({ status: "refused" })
      .mockImplementation(buildAdapters(lesson).checkStep);

    const completeLesson = vi
      .fn<LessonPlayerAdapters["completeLesson"]>()
      .mockResolvedValueOnce({ status: "incomplete" })
      .mockImplementation(finished);

    const runId = crypto.randomUUID();
    const startLesson = vi.fn(() => Promise.resolve(startedRun({ runId })));

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { checkStep, completeLesson, startLesson }),
      lesson,
    });

    await answer(RIGHT_OPTION, "Correct!");
    await expect.element(notSaved()).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(notSaved()).not.toBeInTheDocument();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect
      .element(
        page.getByText("Your answer here didn't save. Answer it again to finish the lesson."),
      )
      .toBeVisible();

    await expect.element(page.getByRole("radio", { name: RIGHT_OPTION })).not.toBeChecked();
    expect(unsentKeys()).toStrictEqual([]);
  });

  it("places a learner who taps while the page loads where the kept answers lead", async () => {
    const lesson = buildLesson([
      teachingStep("hook"),
      teachingStep("check"),
      {
        ...teachingStep("explanation"),
        content: { text: "Denser means more likely.", title: "Reading it" },
      },
      teachingStep("check"),
    ]);

    const [first] = stepIdsOf(lesson, "check");

    keepUnsentAnswer({
      answer: {
        answer: { kind: "check", optionId: "likely" },
        answeredAt: new Date().toISOString(),
        attemptId: crypto.randomUUID(),
        durationMs: 3000,
        isCorrect: true,
        runId: crypto.randomUUID(),
        stepId: first ?? "",
        usedHelp: false,
      },
      learnerId: LEARNER_ID,
      lessonId: lesson.id,
    });

    const server = fakeServer(lesson);
    const adapters = buildAdapters(lesson, server);

    const player = (
      <TestIntl>{lessonPlayerElement({ adapters, firstAnswer: "no", lesson })}</TestIntl>
    );

    const container = document.createElement("div");
    container.innerHTML = renderToString(player);
    document.body.append(container);

    const seeAnswer = container.querySelector<HTMLButtonElement>(`#${LESSON_PRIMARY_ID}`);
    expect(seeAnswer?.textContent).toMatch(/^See the answer/u);

    const root = hydrateRoot(container, player);
    seeAnswer?.click();

    await expect.element(page.getByRole("heading", { name: "Reading it" })).toBeVisible();
    await expect.poll(() => server.startLesson.mock.calls.length).toBe(1);
    await expect.element(page.getByRole("heading", { name: "Reading it" })).toBeVisible();
    expect(server.checkStep).toHaveBeenCalledOnce();

    root.unmount();
    container.remove();
  });
});

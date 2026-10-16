import { act } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import {
  acceptedAnswerCheck,
  buildAdapters,
  renderLessonPlayer,
  runAnswer,
  startedRun,
} from "../_test-utils/render-lesson-player";
import { useLessonPlayer } from "../lesson/lesson-player-context";
import { LessonPlayerShell } from "../lesson/lesson-player-shell";
import { type LessonPlayerState } from "../lesson/lesson-player-state";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import {
  contentStep,
  explanationStep,
  inlineImage,
  numberedCheckStep,
} from "../preview/preview-steps";

const WAIT_MS = 300_000;
const EARLY_WAIT_MS = 152_000;
const POLL_MS = 4000;
const ANSWER = "Plants turn sunlight into stored energy.";
const NOT_SAVED = "Your answer here didn't save. Answer it again to finish the lesson.";
const PICTURE_READY = "This question was waiting for its picture. Answer it to finish the lesson.";

function StateObserver({ observe }: { observe: (state: LessonPlayerState) => void }) {
  const { state } = useLessonPlayer();
  useEffect(() => observe(state), [observe, state]);
  return null;
}

function openPictures(overrides: Partial<LessonPlayerAdapters> = {}, ageMs = 0) {
  vi.useFakeTimers({ shouldAdvanceTime: true });

  const current = contentStep("typedAnswer", {
    content: {
      acceptedAnswers: [ANSWER],
      keyPoints: ["Sunlight becomes stored energy"],
      question: "What does a plant do with sunlight?",
      sampleAnswer: ANSWER,
    },
  });

  const picture = {
    ...numberedCheckStep({ drawn: false, imagePending: true }),
    pictureWaitStartedAt: Date.now() - ageMs,
  };

  const last = explanationStep({ text: "The lesson can finish without the lost picture." });
  const lesson = buildLesson([current, picture, last]);
  const observe = vi.fn<(state: LessonPlayerState) => void>();

  const adapters = buildAdapters(lesson, {
    checkStep: acceptedAnswerCheck(current),
    getLessonPictures: vi.fn(async () => []),
    startLesson: vi.fn().mockResolvedValue(startedRun()),
    ...overrides,
  });

  renderLessonPlayer({
    adapters,
    children: (
      <>
        <LessonPlayerShell />
        <StateObserver observe={observe} />
      </>
    ),
    lesson,
  });

  const state = () => observe.mock.calls.at(-1)?.[0];
  return { adapters, current, last, picture, state };
}

async function waitForPictureDeadline() {
  await act(() => vi.advanceTimersByTimeAsync(WAIT_MS + POLL_MS));
}

/** Answers the first question and reads on to the end, where the lesson asks to be completed. */
async function finishLesson({
  current,
  last,
}: Pick<ReturnType<typeof openPictures>, "current" | "last">) {
  await page.getByRole("textbox", { name: current.content.question }).fill(ANSWER);
  await page.getByRole("button", { name: /^Check/u }).click();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
  await expect.element(page.getByText(last.content.text)).toBeVisible();
  await page.getByRole("button", { exact: true, name: "Continue" }).click();
}

async function resyncMissingAnswer({
  current,
  last,
  state,
}: Pick<ReturnType<typeof openPictures>, "current" | "last" | "state">) {
  await finishLesson({ current, last });
  await expect.poll(() => state()?.notice).toBe("answerNotSaved");
  await expect.element(page.getByText(NOT_SAVED)).toBeVisible();
}

describe("picture loss during a lesson", () => {
  afterEach(() => vi.useRealTimers());

  it("reads an unresolved screen once more when its next poll crosses the picture deadline", async () => {
    const getLessonPictures = vi
      .fn<NonNullable<LessonPlayerAdapters["getLessonPictures"]>>()
      .mockResolvedValue([]);

    const { picture, state } = openPictures({ getLessonPictures }, WAIT_MS - POLL_MS / 2);
    await expect.poll(() => getLessonPictures.mock.calls.length).toBeGreaterThan(0);

    // The image lands after the last pre-deadline read. The adapter honors the requested IDs.
    getLessonPictures.mockImplementation(async (stepIds) =>
      stepIds?.includes(picture.id)
        ? [{ image: inlineImage({ alt: "Numbered parts" }), stepId: picture.id }]
        : [],
    );

    await act(() => vi.advanceTimersByTimeAsync(POLL_MS));
    expect(getLessonPictures).toHaveBeenLastCalledWith([picture.id]);
    expect(state()?.queue).toContain(picture.id);
  });

  it("waits for Finish when the last required picture expires on entry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const picture = {
      ...numberedCheckStep({ drawn: false, imagePending: true }),
      pictureWaitStartedAt: Date.now() - WAIT_MS,
    };

    const lesson = buildLesson([picture]);
    const adapters = buildAdapters(lesson, { getLessonPictures: vi.fn(async () => []) });
    renderLessonPlayer({ adapters, lesson });

    await expect
      .element(page.getByRole("heading", { name: "Nothing left to answer" }))
      .toBeVisible();

    expect(adapters.completeLesson).not.toHaveBeenCalled();

    await page.getByRole("button", { exact: true, name: "Finish" }).click();
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    expect(adapters.completeLesson).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    "recovers a newly drawn required question, including after an earlier resync: %s",
    async (resyncFirst) => {
      const completeLesson = vi
        .fn<LessonPlayerAdapters["completeLesson"]>()
        .mockResolvedValue({ status: "incomplete" });

      const getLessonPictures = vi
        .fn<NonNullable<LessonPlayerAdapters["getLessonPictures"]>>()
        .mockResolvedValue([]);

      const resumedRun = startedRun();

      const startLesson = vi
        .fn<LessonPlayerAdapters["startLesson"]>()
        .mockResolvedValue(resumedRun);

      const { current, last, picture, state } = openPictures({
        completeLesson,
        getLessonPictures,
        startLesson,
      });

      await waitForPictureDeadline();

      if (resyncFirst) {
        await resyncMissingAnswer({ current, last, state });
      }

      getLessonPictures.mockResolvedValue([
        {
          image: inlineImage({ alt: picture.content.image?.alt ?? "Numbered parts" }),
          stepId: picture.id,
        },
      ]);

      // The server has the first answer; only the question that waited for its picture is open.
      startLesson.mockResolvedValue(
        startedRun({ answers: [runAnswer({ stepId: current.id })], runId: resumedRun.runId }),
      );

      await finishLesson({ current, last });
      await expect.element(page.getByText(picture.content.question)).toBeVisible();
      await expect.element(page.getByText(PICTURE_READY)).toBeVisible();
      await expect.element(page.getByText(NOT_SAVED)).not.toBeInTheDocument();
      await expect.element(page.getByRole("radio").first()).toBeEnabled();
    },
  );

  it("still requires a newly written numbered screen after 152 seconds", async () => {
    const { picture, state } = openPictures();
    await act(() => vi.advanceTimersByTimeAsync(EARLY_WAIT_MS));
    expect(state()?.queue).toContain(picture.id);
  });

  it("uses the screen's original generation time rather than restarting the wait on entry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const picture = {
      ...numberedCheckStep({ drawn: false, imagePending: true }),
      pictureWaitStartedAt: Date.now() - WAIT_MS + POLL_MS,
    };

    const last = explanationStep({ text: "An older picture has already had its full wait." });
    const lesson = buildLesson([picture, last]);

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { getLessonPictures: vi.fn(async () => []) }),
      lesson,
    });

    await expect.element(page.getByText(picture.content.question)).toBeVisible();
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 2));
    await expect.element(page.getByText(last.content.text)).toBeVisible();
  });

  it("keeps the current draft and timer when only a future picture is lost", async () => {
    const { current, picture, state } = openPictures();
    await page.getByRole("textbox", { name: current.content.question }).fill(ANSWER);
    const before = state();
    await waitForPictureDeadline();
    expect(state()?.queue).not.toContain(picture.id);
    expect(state()?.answers[current.id]).toStrictEqual(before?.answers[current.id]);
    expect(state()?.stepStartedAt).toBe(before?.stepStartedAt);
    expect(state()?.phase).toBe(before?.phase);

    await expect
      .element(page.getByRole("textbox", { name: current.content.question }))
      .toHaveValue(ANSWER);
  });

  it.each(["checking", "feedback"] as const)(
    "keeps picture loss received during %s and advances past it",
    async (phase) => {
      const check = Promise.withResolvers<Awaited<ReturnType<LessonPlayerAdapters["checkStep"]>>>();

      const { current, last, picture, state } = openPictures(
        { checkStep: vi.fn(() => check.promise) },
        WAIT_MS - POLL_MS * 2,
      );

      await page.getByRole("textbox", { name: current.content.question }).fill(ANSWER);
      await page.getByRole("button", { name: /^Check/u }).click();

      const resolveCheck = async () => {
        await act(async () => {
          check.resolve({
            result: {
              checked: true,
              correctAnswer: null,
              corrections: [],
              feedback: null,
              isCorrect: true,
              keyPoints: [],
              nextReviewAt: null,
              savedMistake: false,
              score: 1,
              spelling: null,
            },
            status: "checked",
          });

          await check.promise;
        });
      };

      if (phase === "feedback") {
        await resolveCheck();
      }

      await expect.poll(() => state()?.phase).toBe(phase);
      const before = state();
      await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 3));
      expect(state()?.queue).not.toContain(picture.id);
      expect(state()?.phase).toBe(phase);
      expect(state()?.answers[current.id]).toStrictEqual(before?.answers[current.id]);
      expect(state()?.results[current.id]).toStrictEqual(before?.results[current.id]);
      expect(state()?.stepStartedAt).toBe(before?.stepStartedAt);

      if (phase === "checking") {
        await resolveCheck();
      }

      await page.getByRole("button", { exact: true, name: "Continue" }).click();
      await expect.element(page.getByText(last.content.text)).toBeVisible();
    },
  );

  it("leaves a question whose picture came after its wait out of the run, bringing back only a missing answer", async () => {
    const completeLesson = vi
      .fn<LessonPlayerAdapters["completeLesson"]>()
      .mockResolvedValueOnce({ status: "incomplete" })
      .mockResolvedValue({
        completion: {
          brainPower: 10,
          correctCount: 1,
          energyDelta: 1,
          incorrectCount: 0,
          isFirstCompletion: true,
          nextReviewAt: null,
          seconds: 60,
          studyBlock: null,
          totalBrainPower: 10,
        },
        status: "completed",
      });

    const getLessonPictures = vi
      .fn<NonNullable<LessonPlayerAdapters["getLessonPictures"]>>()
      .mockResolvedValue([]);

    const { current, last, picture, state } = openPictures({ completeLesson, getLessonPictures });
    await waitForPictureDeadline();

    // Drawn once its wait was over: the server doesn't ask for it in this run, only the lost answer.
    getLessonPictures.mockResolvedValue([
      {
        image: inlineImage({ alt: picture.content.image?.alt ?? "Numbered parts" }),
        stepId: picture.id,
      },
    ]);

    await resyncMissingAnswer({ current, last, state });
    expect(state()?.queue).not.toContain(picture.id);

    await page.getByRole("textbox", { name: current.content.question }).fill(ANSWER);
    await page.getByRole("button", { name: /^Check/u }).click();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();
    await expect.element(page.getByText(last.content.text)).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();

    await expect.poll(() => state()?.completion?.status).toBe("saved");
    expect(completeLesson).toHaveBeenCalledTimes(2);
    await expect.element(page.getByText(picture.content.question)).not.toBeInTheDocument();
  });

  it("keeps valid omissions when completion resync returns to a missing answer", async () => {
    const completeLesson = vi
      .fn<LessonPlayerAdapters["completeLesson"]>()
      .mockResolvedValue({ status: "incomplete" });

    const { current, last, picture, state } = openPictures({ completeLesson });
    await waitForPictureDeadline();
    await page.getByRole("textbox", { name: current.content.question }).fill(ANSWER);
    await page.getByRole("button", { name: /^Check/u }).click();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();
    await expect.element(page.getByText(last.content.text)).toBeVisible();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();
    await expect.poll(() => completeLesson).toHaveBeenCalled();
    await expect.poll(() => state()?.notice).toBe("answerNotSaved");
    await expect.element(page.getByText(NOT_SAVED)).toBeVisible();
    expect(state()?.queue).not.toContain(picture.id);

    await expect
      .element(page.getByRole("textbox", { name: current.content.question }))
      .toBeVisible();

    await page.getByRole("textbox", { name: current.content.question }).fill(ANSWER);
    await page.getByRole("button", { name: /^Check/u }).click();
    await page.getByRole("button", { exact: true, name: "Continue" }).click();
    await expect.element(page.getByText(last.content.text)).toBeVisible();
  });

  it.each([false, true])(
    "keeps an arrived picture optional on reload with prior answers: %s",
    async (answered) => {
      const picture = numberedCheckStep({ drawn: true });
      const last = explanationStep({ text: "Keep going where you left off." });
      const lesson = buildLesson([picture, last]);

      const start = startedRun({
        answers: answered ? [runAnswer({ stepId: picture.id })] : [],
        optionalStepIds: [picture.id],
      });

      const adapters = buildAdapters(lesson, { startLesson: vi.fn(async () => start) });
      renderLessonPlayer({ adapters, lesson });
      await expect.element(page.getByText(picture.content.question)).not.toBeInTheDocument();
      expect(adapters.completeLesson).not.toHaveBeenCalled();

      if (answered) {
        await page.getByRole("button", { exact: true, name: "Finish" }).click();
      } else {
        await page.getByRole("button", { exact: true, name: "Continue" }).click();
      }

      await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
      expect(adapters.completeLesson).toHaveBeenCalledOnce();
    },
  );

  it("asks the now-pictured question in the next run", async () => {
    const picture = numberedCheckStep({ drawn: true });
    const lesson = buildLesson([picture]);

    const adapters = buildAdapters(lesson, {
      startLesson: vi.fn(async () => startedRun({ optionalStepIds: [] })),
    });

    renderLessonPlayer({ adapters, lesson });
    await expect.poll(() => adapters.startLesson).toHaveBeenCalledOnce();
    await expect.element(page.getByText(picture.content.question)).toBeVisible();
    expect(adapters.completeLesson).not.toHaveBeenCalled();
  });

  it("recovers an on-time picture missed while offline after a pause longer than the resume window", async () => {
    const run = startedRun();
    const startLesson = vi.fn<LessonPlayerAdapters["startLesson"]>().mockResolvedValue(run);

    const getLessonPictures = vi
      .fn<NonNullable<LessonPlayerAdapters["getLessonPictures"]>>()
      .mockResolvedValue([]);

    const completeLesson = vi
      .fn<LessonPlayerAdapters["completeLesson"]>()
      .mockResolvedValue({ status: "incomplete" });

    const { current, last, picture } = openPictures({
      completeLesson,
      getLessonPictures,
      startLesson,
    });

    await waitForPictureDeadline();
    vi.setSystemTime(Date.now() + 31 * 60_000);

    getLessonPictures.mockResolvedValue([
      { image: inlineImage({ alt: "Numbered parts" }), stepId: picture.id },
    ]);

    startLesson.mockResolvedValue(
      startedRun({
        answers: [runAnswer({ stepId: current.id })],
        optionalStepIds: [],
        runId: run.runId,
      }),
    );

    await finishLesson({ current, last });
    await expect.element(page.getByText(picture.content.question)).toBeVisible();
    await expect.element(page.getByText(PICTURE_READY)).toBeVisible();
    expect(startLesson).toHaveBeenLastCalledWith({ runId: run.runId });
  });
});

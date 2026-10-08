import { MAX_ANSWER_DURATION_MS } from "@zoonk/core/learner/contract";
import { lessonStepCheckInputSchema } from "@zoonk/core/lesson-player/contract";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { teachingStep } from "../_test-utils/lesson-steps";
import {
  buildAdapters,
  buildLesson,
  renderLessonPlayer,
  runAnswer,
  startedRun,
} from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";

/**
 * Coming back to a lesson: the run on the server keeps the learner's answers, so the lesson opens
 * where they left off, and the end never asks to save again and again.
 */

const QUESTION = 'What does the electron "cloud" show?';
const RIGHT_OPTION = "Where the electron is most likely to be found";
const TEN_HOURS_MS = 36_000_000;

/** Explanation, check, explanation, check: the second check is still to answer. */
function createLesson() {
  return buildLesson([
    teachingStep("explanation"),
    teachingStep("check"),
    {
      ...teachingStep("explanation"),
      content: { text: "Denser means more likely.", title: "Reading it" },
    },
    teachingStep("check"),
  ]);
}

function checkIds(lesson: ReturnType<typeof createLesson>) {
  return lesson.steps.filter((step) => step.kind === "check").map((step) => step.id);
}

async function answerRight() {
  await page.getByRole("radio", { name: RIGHT_OPTION }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect.element(page.getByRole("status").filter({ hasText: "Correct!" })).toBeVisible();
}

describe("coming back to a lesson", () => {
  it("opens at the first screen still to answer, after its reading, and counts what was answered", async () => {
    const lesson = createLesson();
    const [first] = checkIds(lesson);
    const resume = [runAnswer({ stepId: first ?? "" })];

    const adapters = buildAdapters(lesson, {
      startLesson: () => Promise.resolve(startedRun({ answers: resume })),
    });

    renderLessonPlayer({ adapters, lesson, resume });

    await expect.element(page.getByText("Reading it")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Previous screen" })).toBeVisible();

    await page.getByRole("button", { name: /^Next/u }).click();
    await answerRight();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    // The first check was answered before the learner left: only the one shown here is new.
    expect(adapters.checkStep).toHaveBeenCalledOnce();
  });

  it("continues a lesson left days ago, with Hyperdrive counting only this sitting's answers", async () => {
    const lesson = buildLesson([
      teachingStep("check"),
      teachingStep("check"),
      teachingStep("check"),
      teachingStep("check"),
    ]);

    const [first, second] = checkIds(lesson);
    const twoDaysAgo = 2 * 24 * 60;

    // Two right answers two days ago: they count, but don't build today's streak.
    const resume = [
      runAnswer({ minutesAgo: twoDaysAgo, stepId: first ?? "" }),
      runAnswer({ minutesAgo: twoDaysAgo - 1, stepId: second ?? "" }),
    ];

    const adapters = buildAdapters(lesson, {
      startLesson: () => Promise.resolve(startedRun({ answers: resume })),
    });

    renderLessonPlayer({ adapters, lesson, resume });

    // Replaying the earlier sitting would make this the third in a row.
    await answerRight();
    await expect.element(page.getByText(/right in a row/u)).not.toBeInTheDocument();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await answerRight();
    await expect.element(page.getByText(/right in a row/u)).not.toBeInTheDocument();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    expect(adapters.checkStep).toHaveBeenCalledTimes(2);
  });

  it("continues from the run's answers when only the server knew them", async () => {
    const lesson = createLesson();
    const [first] = checkIds(lesson);

    renderLessonPlayer({
      adapters: buildAdapters(lesson, {
        startLesson: () =>
          Promise.resolve(
            startedRun({ answers: [runAnswer({ isCorrect: false, stepId: first ?? "" })] }),
          ),
      }),
      lesson,
    });

    await expect.element(page.getByText("Reading it")).toBeVisible();
  });

  it("goes back to an answer that never reached the server instead of failing the save forever", async () => {
    const lesson = createLesson();
    const [first] = checkIds(lesson);
    const finished = buildAdapters(lesson).completeLesson;

    // The second answer never arrived: the server only has the first one.
    const startLesson = vi
      .fn<LessonPlayerAdapters["startLesson"]>()
      .mockResolvedValueOnce(startedRun())
      .mockResolvedValue(startedRun({ answers: [runAnswer({ stepId: first ?? "" })] }));

    const completeLesson = vi
      .fn<LessonPlayerAdapters["completeLesson"]>()
      .mockResolvedValueOnce({ status: "incomplete" })
      .mockImplementation(finished);

    renderLessonPlayer({
      adapters: buildAdapters(lesson, { completeLesson, startLesson }),
      lesson,
    });

    await page.getByRole("button", { name: /^Next/u }).click();
    await answerRight();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await page.getByRole("button", { name: /^Next/u }).click();
    await answerRight();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect
      .element(
        page.getByText("Your answer here didn't save. Answer it again to finish the lesson."),
      )
      .toBeVisible();

    await expect.element(page.getByText("Reading it")).toBeVisible();

    await expect
      .element(page.getByText("We couldn't save your progress yet."))
      .not.toBeInTheDocument();

    await page.getByRole("button", { name: /^Next/u }).click();
    await expect.element(page.getByText(QUESTION)).toBeVisible();
    await answerRight();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    expect(completeLesson).toHaveBeenCalledTimes(2);
  });

  it("offers to save again when the save never reached the server, then finishes", async () => {
    const lesson = buildLesson([teachingStep("explanation")]);
    const finished = buildAdapters(lesson).completeLesson;

    const completeLesson = vi
      .fn<LessonPlayerAdapters["completeLesson"]>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockImplementation(finished);

    renderLessonPlayer({ adapters: buildAdapters(lesson, { completeLesson }), lesson });

    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByText("We couldn't save your progress yet.")).toBeVisible();

    await page.getByRole("button", { name: "Try again" }).click();
    await expect.element(page.getByText("+10 Brain Power")).toBeVisible();
    await expect.element(page.getByRole("link", { name: /^Continue/u })).toBeVisible();
  });

  it("finishes without sending again an answer the run refused", async () => {
    const lesson = buildLesson([teachingStep("check")]);

    const checkStep = vi
      .fn<LessonPlayerAdapters["checkStep"]>()
      .mockResolvedValue({ status: "refused" });

    const adapters = buildAdapters(lesson, { checkStep });

    renderLessonPlayer({ adapters, lesson });

    await answerRight();
    await page.getByRole("button", { name: /^Continue/u }).click();

    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();
    expect(checkStep).toHaveBeenCalledOnce();
    expect(adapters.completeLesson).toHaveBeenCalledOnce();
  });

  it("finishes a lesson left open overnight: idle time is sent as at most the answer limit", async () => {
    const lesson = buildLesson([teachingStep("check")]);
    const graded = buildAdapters(lesson).checkStep;

    // The server takes the answer only when it fits its contract, as `POST /v1/steps/{id}/checks` does.
    const checkStep = vi.fn<LessonPlayerAdapters["checkStep"]>((input) => {
      const { stepId, ...body } = input;
      const fits = lessonStepCheckInputSchema.safeParse({ ...body, timeZone: "UTC" }).success;
      return fits && stepId ? graded(input) : Promise.resolve({ status: "failed" });
    });

    const adapters = buildAdapters(lesson, { checkStep });
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });

    try {
      renderLessonPlayer({ adapters, lesson });
      await expect.element(page.getByText(QUESTION)).toBeVisible();

      vi.setSystemTime(Date.now() + TEN_HOURS_MS);
      await answerRight();
      await page.getByRole("button", { name: /^Continue/u }).click();

      await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

      await expect
        .element(page.getByText("We couldn't save your progress yet."))
        .not.toBeInTheDocument();

      expect(checkStep).toHaveBeenCalledOnce();
      expect(checkStep.mock.calls[0]?.[0].durationMs).toBe(MAX_ANSWER_DURATION_MS);
    } finally {
      vi.useRealTimers();
    }
  });
});

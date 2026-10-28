import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { type LessonCheckOutcome, type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { CHECK_BOUNDS } from "../lesson/use-step-grading";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

const RIGHT_OPTION = "Where the electron is most likely to be found";
const WRONG_OPTION = "The electron's exact path";
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u;
const MS_PER_DAY = 86_400_000;

async function answer(option: string, expected: string) {
  await page.getByRole("radio", { name: option }).click();
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect.element(page.getByRole("status").filter({ hasText: expected })).toBeVisible();
}

describe("saving answers", () => {
  afterEach(() => {
    vi.useRealTimers();
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
});

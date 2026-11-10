import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import {
  type Actions,
  practiceFeedback as feedback,
  openPractice,
} from "../_test-utils/mistake-practice";
import { languageStep, spokenAnswerStep, teachingStep } from "../preview/preview-steps";

describe("exact lesson mistake practice", () => {
  afterEach(() => vi.restoreAllMocks());

  it("checks the original lesson option and counts the saved answer when ending early", async () => {
    const step = teachingStep("check");
    const actions = openPractice(step);

    await page
      .getByRole("radio", { name: "Where the electron is most likely to be found" })
      .click();

    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();

    expect(actions.answer).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: { kind: "check", optionId: "likely" },
        mistakeId: "original-mistake",
        stepId: step.id,
      }),
    );

    expect(actions.answer).not.toHaveBeenCalledWith(
      expect.objectContaining({ itemId: expect.any(String) }),
    );

    await page.getByRole("button", { name: "End practice. What you answered counts." }).click();
    await expect.element(page.getByRole("heading", { name: "Practice done" })).toBeVisible();
    expect(actions.finish).toHaveBeenCalledWith({ answerIds: ["saved-answer"] });
  });

  it("keeps a typed draft and resends the same attempt after a lost response", async () => {
    const answer = vi
      .fn<Actions["answer"]>()
      .mockRejectedValueOnce(new Error("Network lost"))
      .mockResolvedValue(feedback());

    openPractice(teachingStep("typedAnswer"), { answer });
    const field = page.getByRole("textbox");
    await field.fill("Where the electron is likely to be");
    await page.getByRole("button", { name: /^Check/u }).click();

    await expect
      .element(page.getByRole("alert"))
      .toHaveTextContent("That didn't go through. Your answers are kept. Try again");

    await expect.element(field).toHaveValue("Where the electron is likely to be");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();
    expect(answer.mock.calls[0]?.[0]).toStrictEqual(answer.mock.calls[1]?.[0]);
  });

  it("uses a new attempt when the learner edits a failed typed answer", async () => {
    const answer = vi
      .fn<Actions["answer"]>()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(feedback());

    openPractice(teachingStep("typedAnswer"), { answer });
    await page.getByRole("textbox").fill("First answer");
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("alert")).toBeVisible();
    await page.getByRole("textbox").fill("A revised answer");
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();
    expect(answer.mock.calls[0]?.[0].attemptId).not.toBe(answer.mock.calls[1]?.[0].attemptId);
  });

  it("shows an unchecked answer without counting it as a saved answer", async () => {
    const actions = openPractice(teachingStep("typedAnswer"), {
      answer: vi.fn<Actions["answer"]>().mockResolvedValue(feedback(false)),
    });

    await page.getByRole("textbox").fill("A paraphrase");
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Practice done" })).toBeVisible();
    expect(actions.finish).not.toHaveBeenCalled();
  });

  it.each([
    "fillBlank",
    "listening",
    "reading",
    "multipleChoice",
    "translation",
    "matchColumns",
  ] as const)("keeps the original %s exercise and can reveal it without guessing", async (kind) => {
    const step = languageStep(kind);
    const actions = openPractice(step);
    await page.getByRole("button", { exact: true, name: "I don't know yet" }).click();
    await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();

    expect(actions.answer).toHaveBeenCalledWith(
      expect.objectContaining({ answer: { dontKnow: true }, stepId: step.id }),
    );
  });

  it("walks the original challenge through its decisions before checking", async () => {
    const step = teachingStep("challenge");
    const actions = openPractice(step);
    await page.getByRole("button", { exact: true, name: "Start" }).click();
    await page.getByRole("radio").first().click();
    await page.getByRole("button", { exact: true, name: "Confirm" }).click();
    await page.getByRole("radio").first().click();
    await page.getByRole("button", { exact: true, name: "Confirm" }).click();
    await page.getByRole("radio").first().click();
    await page.getByRole("button", { exact: true, name: "Confirm" }).click();
    await page.getByRole("button", { exact: true, name: "See how it went" }).click();

    expect(actions.answer).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: expect.objectContaining({ kind: "challenge" }),
        stepId: step.id,
      }),
    );
  });

  it("keeps a throttled recording for retry, but starts a fresh attempt when no speech was heard", async () => {
    const audio = new AudioContext();

    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockImplementation(
      async () => audio.createMediaStreamDestination().stream,
    );

    const grade = {
      attemptId: crypto.randomUUID(),
      explanation: null,
      isCorrect: true,
      score: 1,
      transcript: "How much is the rent?",
      words: [],
      wordsToPractice: [],
    };

    const record = vi
      .fn<NonNullable<Actions["record"]>>()
      .mockResolvedValueOnce({ retryAfterSeconds: 1, status: "slowDown" })
      .mockResolvedValueOnce({ status: "noSpeech" })
      .mockResolvedValue({ feedback: feedback(), grade, status: "graded" });

    openPractice(spokenAnswerStep(), { record });
    await page.getByRole("button", { exact: true, name: "Record" }).click();
    await page.getByRole("button", { name: /^Stop/u }).click();
    await expect.element(page.getByRole("alert")).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await page.getByRole("button", { exact: true, name: "Record" }).click();
    await page.getByRole("button", { name: /^Stop/u }).click();
    await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();
    expect(record.mock.calls[0]?.[0]).toStrictEqual(record.mock.calls[1]?.[0]);
    expect(record.mock.calls[1]?.[0].attemptId).not.toBe(record.mock.calls[2]?.[0].attemptId);
    expect(record.mock.calls[0]?.[0].practiceDurationMs).toBeGreaterThanOrEqual(0);
    await audio.close();
  });

  it("keeps a spoken recording for a network retry and sends its original step", async () => {
    const audio = new AudioContext();

    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockImplementation(
      async () => audio.createMediaStreamDestination().stream,
    );

    const grade = {
      attemptId: crypto.randomUUID(),
      explanation: null,
      isCorrect: true,
      score: 1,
      transcript: "How much is the rent?",
      words: [],
      wordsToPractice: [],
    };

    const record = vi
      .fn<NonNullable<Actions["record"]>>()
      .mockRejectedValueOnce(new Error("Network lost"))
      .mockResolvedValue({ feedback: feedback(), grade, status: "graded" });

    const step = spokenAnswerStep();
    openPractice(step, { record });
    await page.getByRole("button", { exact: true, name: "Record" }).click();
    await page.getByRole("button", { name: /^Stop/u }).click();
    await expect.element(page.getByRole("alert")).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();
    expect(record.mock.calls[0]?.[0]).toStrictEqual(record.mock.calls[1]?.[0]);
    expect(record.mock.calls[1]?.[0].stepId).toBe(step.id);
    await audio.close();
  });

  it("shows the timed practice verdict while retaining the spoken transcript", async () => {
    const audio = new AudioContext();

    vi.spyOn(navigator.mediaDevices, "getUserMedia").mockImplementation(
      async () => audio.createMediaStreamDestination().stream,
    );

    const checked = feedback();

    const grade = {
      attemptId: crypto.randomUUID(),
      explanation: null,
      isCorrect: true,
      score: 1,
      transcript: "How much is the rent?",
      words: [],
      wordsToPractice: [],
    };

    const record = vi
      .fn<NonNullable<Actions["record"]>>()
      .mockResolvedValue({
        feedback: {
          ...checked,
          fixed: false,
          fixedMistakeIds: [],
          isCorrect: false,
          lessonResult: checked.lessonResult
            ? { ...checked.lessonResult, isCorrect: false, score: null }
            : null,
          mistakeStatus: "open",
        },
        grade,
        status: "graded",
      });

    openPractice(spokenAnswerStep(), { record });
    await page.getByRole("button", { exact: true, name: "Record" }).click();
    await page.getByRole("button", { name: /^Stop/u }).click();
    const verdict = page.getByRole("region", { name: "Answer feedback" });
    await expect.element(verdict).toBeVisible();
    await expect.element(verdict).toMatchTextContent(/Not quite/u);
    await expect.element(verdict).toMatchTextContent(/How much is the rent\?/u);
    await audio.close();
  });
});

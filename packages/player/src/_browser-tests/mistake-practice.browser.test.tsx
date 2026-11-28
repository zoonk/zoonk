import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { allowMicrophone } from "../_test-utils/microphone";
import {
  type Actions,
  practiceFeedback as feedback,
  openPractice,
  practiceEntries,
} from "../_test-utils/mistake-practice";
import { languageStep, spokenAnswerStep, teachingStep } from "../preview/preview-steps";

function matchCard(name: string) {
  return page.getByRole("button", { exact: true, name });
}

describe("exact lesson mistake practice", () => {
  afterEach(() => vi.restoreAllMocks());

  it("continues a checked typed replay with a fresh Enter, keeping feedback while Enter is held", async () => {
    const actions = openPractice(teachingStep("typedAnswer"));
    await page.getByRole("textbox").fill("Where the electron is likely to be");
    await userEvent.keyboard("{Enter>8}{/Enter}");
    await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("heading", { name: "Practice done" })).toBeVisible();
    expect(actions.finish).toHaveBeenCalledWith({ answerIds: ["saved-answer"] });
  });

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

    await page.getByRole("button", { name: "Leave. What you answered counts." }).click();
    await expect.element(page.getByRole("heading", { name: "Practice done" })).toBeVisible();
    expect(actions.finish).toHaveBeenCalledWith({ answerIds: ["saved-answer"] });
  });

  it("draws a lesson's question on the same edges as its feedback, on a phone", async () => {
    await atViewport({ height: 844, width: 390 }, async () => {
      openPractice(teachingStep("check"));

      const option = page.getByRole("radio", {
        name: "Where the electron is most likely to be found",
      });

      await option.click();
      await page.getByRole("button", { name: /^Check/u }).click();
      const verdict = page.getByRole("region", { name: "Answer feedback" });
      await expect.element(verdict).toBeVisible();

      const answer = option.element().getBoundingClientRect();
      const card = verdict.element().getBoundingClientRect();

      expect([answer.left, answer.right]).toStrictEqual([card.left, card.right]);
    });
  });

  it("puts a word bank's feedback above the bank, which holds still, on a phone", async () => {
    await atViewport({ height: 844, width: 390 }, async () => {
      openPractice(languageStep("reading"));

      const bank = page.getByRole("group", { name: "Word bank" });
      await expect.element(bank).toBeVisible();
      const before = bank.element().getBoundingClientRect();

      await page.getByRole("button", { exact: true, name: "I don't know yet" }).click();
      const verdict = page.getByRole("region", { name: "Answer feedback" });
      await expect.element(verdict).toBeVisible();

      await expect
        .element(verdict.getByText("Mistake fixed. It leaves your notebook."))
        .toBeVisible();

      const after = bank.element().getBoundingClientRect();
      const bar = document.querySelector("[data-slot=bottom-bar]")!.getBoundingClientRect();
      expect(verdict.element().getBoundingClientRect().bottom).toBeLessThanOrEqual(after.top);
      expect(after.bottom).toBe(before.bottom);
      expect(bar.top - after.bottom).toBe(24);
    });
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
    expect(actions.finish).toHaveBeenCalledExactlyOnceWith({ answerIds: [] });
  });

  it("waits on Continue while a lesson's board is played, then names its first wrong try", async () => {
    const graded = feedback();

    const answer = vi
      .fn<Actions["answer"]>()
      .mockResolvedValue({
        ...graded,
        isCorrect: false,
        lessonResult: graded.lessonResult && { ...graded.lessonResult, isCorrect: false },
      });

    openPractice(languageStep("matchColumns"), { answer });

    await expect.element(page.getByRole("button", { name: /^Continue/u })).toBeDisabled();
    await matchCard("Electron").click();
    await matchCard("Positive charge").click();
    await matchCard("Negative charge").click();
    await matchCard("Proton").click();
    await matchCard("Positive charge").click();
    await matchCard("Neutron").click();
    await matchCard("No charge").click();

    const result = page.getByRole("region", { name: "Answer feedback" });

    await expect
      .element(result.getByText("Electron → Positive charge", { exact: true }))
      .toBeVisible();

    expect(answer).toHaveBeenCalledWith(
      expect.objectContaining({ answer: expect.objectContaining({ mistakes: 1 }) }),
    );
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
    await page.getByRole("button", { exact: true, name: "Check" }).click();
    await page.getByRole("radio").first().click();
    await page.getByRole("button", { exact: true, name: "Check" }).click();
    await page.getByRole("radio").first().click();
    await page.getByRole("button", { exact: true, name: "Check" }).click();
    await page.getByRole("button", { exact: true, name: "See result" }).click();

    expect(actions.answer).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: expect.objectContaining({ kind: "challenge" }),
        stepId: step.id,
      }),
    );
  });

  it("keeps a throttled recording for retry, but starts a fresh attempt when no speech was heard", async () => {
    allowMicrophone();

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
  });

  it("keeps a spoken recording for a network retry, still offering Record in the bar, and sends its original step", async () => {
    allowMicrophone();

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
    await expect.element(page.getByRole("textbox")).not.toBeInTheDocument();

    const recordButton = page.getByRole("button", { exact: true, name: "Record" });
    await expect.element(recordButton).toBeVisible();
    expect(recordButton.element().closest("[data-slot=bottom-bar]")).not.toBeNull();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();
    expect(record.mock.calls[0]?.[0]).toStrictEqual(record.mock.calls[1]?.[0]);
    expect(record.mock.calls[1]?.[0].stepId).toBe(step.id);
  });

  it("shows the timed practice verdict while retaining the spoken transcript", async () => {
    allowMicrophone();

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
  });
});

const SUMMARY = {
  brainPower: 0,
  ceremony: null,
  certificates: [],
  correct: 0,
  hasMorePractice: false,
  missionMoment: null,
  reached: { energy: null, level: null },
  seconds: 30,
  total: 1,
};

async function answerAndContinue() {
  await page.getByRole("textbox").fill("A paraphrase");
  await page.getByRole("button", { name: /^Check/u }).click();
  await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();
  await page.getByRole("button", { name: /^Continue/u }).click();
}

describe("the end of a mistake practice run", () => {
  afterEach(() => vi.restoreAllMocks());

  const MORE = { ...SUMMARY, hasMorePractice: true };

  it("leads with Done and loads a fresh batch for Practice again, saying so when that fails", async () => {
    const again = vi
      .fn<Actions["again"]>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(practiceEntries(teachingStep("typedAnswer")));

    openPractice(teachingStep("typedAnswer"), {
      again,
      finish: vi.fn<Actions["finish"]>().mockResolvedValue(MORE),
    });

    await answerAndContinue();

    await expect
      .element(page.getByRole("link", { name: /^Done/u }))
      .toHaveAttribute("href", "/mistakes");

    await page.getByRole("button", { name: /^Practice again/u }).click();

    await expect
      .element(page.getByText("That didn't go through. Your answers are kept."))
      .toBeVisible();

    await page.getByRole("button", { name: /^Practice again/u }).click();
    await expect.element(page.getByRole("textbox")).toBeVisible();
    expect(again).toHaveBeenCalledTimes(2);
  });

  it("offers no Practice again when only today's misses are left, as the finish says", async () => {
    openPractice(teachingStep("typedAnswer"), {
      answer: vi.fn<Actions["answer"]>().mockResolvedValue(feedback(false)),
      finish: vi.fn<Actions["finish"]>().mockResolvedValue(SUMMARY),
    });

    await answerAndContinue();
    await expect.element(page.getByRole("link", { name: /^Done/u })).toBeVisible();

    await expect
      .element(page.getByRole("button", { name: /^Practice again/u }))
      .not.toBeInTheDocument();
  });

  it("scores a batch from its own answers when the finish counted nothing new", async () => {
    openPractice(teachingStep("typedAnswer"), {
      finish: vi
        .fn<Actions["finish"]>()
        .mockResolvedValue({ ...SUMMARY, brainPower: 0, correct: 0, total: 0 }),
    });

    await answerAndContinue();
    await expect.element(page.getByText(/of 1 right/u)).toBeVisible();
  });

  it("goes on to the day's next stop from a day's block", async () => {
    openPractice(
      teachingStep("typedAnswer"),
      { finish: vi.fn<Actions["finish"]>().mockResolvedValue(MORE) },
      undefined,
      undefined,
      { dayBlock: true, doneHref: "/session" },
    );

    await answerAndContinue();

    await expect
      .element(page.getByRole("link", { name: /^Continue/u }))
      .toHaveAttribute("href", "/session");

    await expect
      .element(page.getByRole("button", { name: /^Practice again/u }))
      .not.toBeInTheDocument();
  });

  it("says an emptied day's block is already fixed, holding it until its completion goes through", async () => {
    const finish = vi
      .fn<Actions["finish"]>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(SUMMARY);

    openPractice(null, { finish }, undefined, undefined, { dayBlock: true, doneHref: "/session" });

    await expect.element(page.getByRole("heading", { name: "Already fixed" })).toBeVisible();

    await expect
      .element(page.getByText("We couldn't mark it done. Check your connection."))
      .toBeVisible();

    await page.getByRole("button", { name: "Try again" }).click();
    await expect.element(page.getByRole("heading", { name: "Already fixed" })).toBeVisible();

    await expect
      .element(page.getByRole("link", { name: /^Done/u }))
      .toHaveAttribute("href", "/session");

    expect(finish).toHaveBeenCalledTimes(2);
    expect(finish).toHaveBeenLastCalledWith({ answerIds: [] });
  });
});

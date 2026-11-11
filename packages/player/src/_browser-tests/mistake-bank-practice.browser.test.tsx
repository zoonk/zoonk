import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import {
  type Actions,
  openPractice,
  practiceFeedback,
  bankQuestion as question,
} from "../_test-utils/mistake-practice";

function bankFeedback() {
  return { ...practiceFeedback(), lessonResult: null };
}

describe("exact standalone bank mistake practice", () => {
  it("asks the mistake's own question without the answer the learner gave then", async () => {
    const answer = vi.fn<Actions["answer"]>().mockResolvedValue(bankFeedback());

    openPractice(null, { answer }, question("typed"));
    await expect.element(page.getByRole("textbox")).toHaveFocus();
    await expect.element(page.getByText("The earlier answer")).not.toBeInTheDocument();

    await page.getByRole("textbox").fill("Mitochondrion");
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();
    await expect.element(page.getByText("The earlier answer")).not.toBeInTheDocument();
  });

  it("keeps the original numeric values and draft after a lost response", async () => {
    const answer = vi
      .fn<Actions["answer"]>()
      .mockRejectedValueOnce(new Error("Lost response"))
      .mockResolvedValue({
        ...bankFeedback(),
        correctAnswer: { number: 8 },
        workedSteps: ["40 × 0.2 = 8"],
      });

    openPractice(null, { answer }, question("numeric"));
    await expect.element(page.getByRole("heading", { name: "What is 20% of 40?" })).toBeVisible();
    await expect.element(page.getByRole("textbox")).toHaveFocus();
    await page.getByRole("textbox").fill("8");
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("alert")).toBeVisible();
    await expect.element(page.getByRole("textbox")).toHaveValue("8");
    await page.getByRole("button", { name: "Try again" }).click();
    await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();
    expect(answer.mock.calls[0]?.[0]).toStrictEqual(answer.mock.calls[1]?.[0]);

    expect(answer.mock.calls[1]?.[0]).toMatchObject({
      answer: { number: 8 },
      itemId: "original-bank-item",
    });

    await expect.element(page.getByText("40 × 0.2 = 8")).toBeVisible();
  });

  it("checks a typed bank answer and shows its correct original wording", async () => {
    const answer = vi
      .fn<Actions["answer"]>()
      .mockResolvedValue({
        ...bankFeedback(),
        correctAnswer: { text: "Mitochondrion" },
        fixed: false,
        fixedMistakeIds: [],
        isCorrect: false,
        mistakeStatus: "open",
      });

    openPractice(null, { answer }, question("typed"));
    await expect.element(page.getByRole("textbox")).toHaveFocus();
    await page.getByRole("textbox").fill("Chloroplast");
    await page.getByRole("button", { name: /^Check/u }).click();

    await expect.element(page.getByText("Right answer: Mitochondrion")).toBeVisible();

    expect(answer).toHaveBeenCalledWith(
      expect.objectContaining({ answer: { text: "Chloroplast" }, itemId: "original-bank-item" }),
    );
  });

  it("keeps the bank ordering controls and sends the selected order", async () => {
    const answer = vi
      .fn<Actions["answer"]>()
      .mockResolvedValue({ ...bankFeedback(), correctAnswer: { order: [0, 1] } });

    openPractice(null, { answer }, question("order"));
    await page.getByRole("checkbox", { name: "First step" }).click();
    await page.getByRole("checkbox", { name: "Second step" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();

    expect(answer).toHaveBeenCalledWith(
      expect.objectContaining({ answer: { order: [0, 1] }, itemId: "original-bank-item" }),
    );
  });

  it("keeps the bank matching controls and sends the original pair indexes", async () => {
    const answer = vi
      .fn<Actions["answer"]>()
      .mockResolvedValue({ ...bankFeedback(), correctAnswer: { matches: [0, 1] } });

    openPractice(null, { answer }, question("matchPairs"));
    await page.getByRole("button", { exact: true, name: "Electron" }).click();
    await page.getByRole("button", { exact: true, name: "Negative charge" }).click();
    await page.getByRole("button", { exact: true, name: "Proton" }).click();
    await page.getByRole("button", { exact: true, name: "Positive charge" }).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();

    expect(answer).toHaveBeenCalledWith(
      expect.objectContaining({ answer: { matches: [0, 1] }, itemId: "original-bank-item" }),
    );
  });
});

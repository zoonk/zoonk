import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { focusOn, press } from "../_test-utils/activity-player";
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

  it("checks a typed bank answer and shows its correct original wording as typed", async () => {
    const answer = vi
      .fn<Actions["answer"]>()
      .mockResolvedValue({
        ...bankFeedback(),
        correctAnswer: { text: "__init__(self, **kwargs**)" },
        fixed: false,
        fixedMistakeIds: [],
        isCorrect: false,
        mistakeStatus: "open",
      });

    openPractice(null, { answer }, question("typed"));
    await expect.element(page.getByRole("textbox")).toHaveFocus();
    await page.getByRole("textbox").fill("Chloroplast");
    await page.getByRole("button", { name: /^Check/u }).click();

    await expect.element(page.getByText("Right answer: __init__(self, **kwargs**)")).toBeVisible();

    expect(answer).toHaveBeenCalledWith(
      expect.objectContaining({ answer: { text: "Chloroplast" }, itemId: "original-bank-item" }),
    );
  });

  it("shows a question's formulas typeset from the first frame, and its feedback's", async () => {
    const answer = vi
      .fn<Actions["answer"]>()
      .mockResolvedValue({
        ...bankFeedback(),
        correctAnswer: { selectedIndex: 0 },
        explanation: String.raw`The exponents add up to $2^{11}$ ways.`,
        fixed: false,
        fixedMistakeIds: [],
        isCorrect: false,
        mistakeStatus: "open",
      });

    openPractice(null, { answer }, question("multipleChoice"));
    await expect.element(page.getByRole("radio").first()).toBeVisible();
    expect(document.querySelectorAll("math")).toHaveLength(4);
    await expect.element(page.getByText("costs $5 or $10")).toBeVisible();

    await page.getByRole("radio").nth(1).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    const feedback = page.getByRole("region", { name: "Answer feedback" });
    await expect.element(feedback).toBeVisible();
    expect(feedback.element().querySelectorAll("math")).toHaveLength(1);
  });

  it("typesets the formulas in a gap's lesson ideas", async () => {
    openPractice(null, {}, question("multipleChoice"), {
      kind: "reteach",
      lesson: {
        id: "gap-lesson",
        ideas: [
          String.raw`The index and the running total take $\Theta(1)$ extra space.`,
          "**A copy** of the input takes $\\Theta(n)$, even with `arr.slice()`.",
        ],
        title: "Space complexity",
      },
      timeLimitSeconds: null,
    });

    const ideas = page.getByRole("list");
    await expect.element(ideas).toBeVisible();
    expect(ideas.element().querySelectorAll("math")).toHaveLength(2);
    expect(ideas.element().querySelector("strong")?.textContent).toBe("A copy");
    expect(ideas.element().querySelector("code")?.textContent).toBe("arr.slice()");
    await expect.element(ideas).not.toHaveTextContent("$");
  });

  it("typesets the formulas in a trap drill's trap", async () => {
    const answer = vi
      .fn<Actions["answer"]>()
      .mockResolvedValue({
        ...bankFeedback(),
        correctAnswer: { selectedIndex: 0 },
        fixed: false,
        fixedMistakeIds: [],
        isCorrect: false,
        mistakeStatus: "open",
        trap: String.raw`Counts the input as extra space: $\Theta(n)$ instead of $\Theta(1)$`,
      });

    openPractice(null, { answer }, question("multipleChoice"), {
      kind: "spotTheTrap",
      lesson: null,
      timeLimitSeconds: null,
    });

    await page.getByRole("radio").nth(1).click();
    await page.getByRole("button", { name: /^Check/u }).click();
    const trap = page.getByText("The trap:").element().parentElement;
    await expect.poll(() => trap?.querySelectorAll("math").length).toBe(2);
    expect(trap?.textContent).not.toContain("$");
  });

  it("keeps the bank ordering controls and sends the selected order", async () => {
    const answer = vi
      .fn<Actions["answer"]>()
      .mockResolvedValue({ ...bankFeedback(), correctAnswer: { order: [1, 0] } });

    openPractice(null, { answer }, question("order"));
    await focusOn(page.getByRole("button", { name: "Second step" }));
    await press("Space");
    const status = page.getByRole("status").filter({ hasText: "Second step" });
    await expect.element(status).toHaveTextContent("Second step is over position 2.");
    await press("ArrowUp");
    await expect.element(status).toHaveTextContent("Second step is over position 1.");
    await press("Space");
    await expect.element(status).toHaveTextContent("Second step dropped at position 1.");
    expect(answer).not.toHaveBeenCalled();
    await page.getByRole("button", { name: /^Check/u }).click();
    await expect.element(page.getByRole("region", { name: "Answer feedback" })).toBeVisible();

    const places = page.getByRole("listitem").filter({ hasText: "Right place" });
    await expect.element(places.first()).toHaveTextContent("1Second stepRight place");
    await expect.element(places.last()).toHaveTextContent("2First stepRight place");
    await expect.element(page.getByRole("radio")).not.toBeInTheDocument();

    expect(answer).toHaveBeenCalledWith(
      expect.objectContaining({ answer: { order: [1, 0] }, itemId: "original-bank-item" }),
    );
  });

  it("locks the order without grading positions when the learner skips", async () => {
    const answer = vi
      .fn<Actions["answer"]>()
      .mockResolvedValue({ ...bankFeedback(), correctAnswer: { order: [0, 1] }, isCorrect: false });

    openPractice(null, { answer }, question("order"));
    await page.getByRole("button", { exact: true, name: "I don't know yet" }).click();

    await expect
      .element(page.getByRole("listitem").filter({ hasText: "First step" }))
      .toBeVisible();

    await expect.element(page.getByText("Drag the steps into order.")).not.toBeInTheDocument();
    await expect.element(page.getByText("Wrong place")).not.toBeInTheDocument();
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

  it("matches with the number keys its entries show, one run across both columns, and a matched entry answers none", async () => {
    const answer = vi
      .fn<Actions["answer"]>()
      .mockResolvedValue({ ...bankFeedback(), correctAnswer: { matches: [0, 1] } });

    openPractice(null, { answer }, question("matchPairs"));
    const electron = page.getByRole("button", { exact: true, name: "Electron" });
    const negative = page.getByRole("button", { exact: true, name: "Negative charge" });
    await expect.element(electron).toHaveAttribute("aria-keyshortcuts", "1");
    await expect.element(negative).toHaveAttribute("aria-keyshortcuts", "3");

    await userEvent.keyboard("1");
    await expect.element(electron).toHaveAttribute("aria-pressed", "true");

    await userEvent.keyboard("3");
    const matched = page.getByRole("button", { name: "Negative charge, matched with Electron" });
    await expect.element(matched).toBeVisible();
    await expect.element(matched).not.toHaveAttribute("aria-keyshortcuts");

    await userEvent.keyboard("3");
    await userEvent.keyboard("1");
    await expect.element(matched).toBeVisible();

    await userEvent.keyboard("2");
    await userEvent.keyboard("4");
    await page.getByRole("button", { name: /^Check/u }).click();

    expect(answer).toHaveBeenCalledWith(
      expect.objectContaining({ answer: { matches: [0, 1] }, itemId: "original-bank-item" }),
    );
  });
});

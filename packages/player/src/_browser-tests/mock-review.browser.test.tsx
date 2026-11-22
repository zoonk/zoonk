import { type MockReviewEntry, type MockSectionView } from "@zoonk/core/exams/mocks/view-contract";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { MockReview } from "../../../learn/src/mock/mock-review";
import { render } from "../_test-utils/render";

function entry(overrides: Partial<MockReviewEntry> & { number: number }): MockReviewEntry {
  return {
    area: "Languages",
    citation: null,
    context: `Passage for question ${overrides.number}.`,
    correctAnswer: "The right option",
    explanation: `Why question ${overrides.number} went wrong.`,
    format: "multipleChoice",
    itemId: `item-${overrides.number}`,
    learnerAnswer: "The picked option",
    outcome: "wrong",
    question: `What does question ${overrides.number} ask?`,
    section: 0,
    set: null,
    total: 10,
    unsure: false,
    ...overrides,
  };
}

const REVIEW = [
  entry({ number: 4 }),
  entry({ number: 7 }),
  entry({ learnerAnswer: null, number: 9, outcome: "blank" }),
];

const REASONING = {
  breakAfterMinutes: null,
  essays: 0,
  index: 0,
  minutes: 20,
  name: "Reasoning",
  navigation: null,
  questions: 10,
  status: "done",
  tools: null,
} satisfies MockSectionView;

const row = (number: number) =>
  page.getByRole("button", { name: `What does question ${number} ask?` });

function top(number: number): number {
  return row(number).element().getBoundingClientRect().top;
}

describe("a mock exam's questions to review", () => {
  it("lists every missed question as a closed row, with how many there are", async () => {
    const sections = [REASONING, { ...REASONING, index: 1, name: "Speaking", questions: 0 }];
    render(<MockReview review={REVIEW} sections={sections} trueFalseLabels="trueFalse" />);

    const list = page.getByRole("region", { name: "Questions to review" });

    await expect.element(list.getByRole("listitem")).toHaveLength(REVIEW.length);
    await expect.element(list.getByText("3", { exact: true })).toBeVisible();
    await expect.element(row(4)).toHaveAttribute("aria-expanded", "false");
    expect(row(4).element().textContent).toMatch(/Question 4 of 10.+Languages.+Wrong$/u);
    await expect.element(page.getByText("Why question 4 went wrong.")).not.toBeInTheDocument();
  });

  it("identifies the section when numbered questions appear in more than one", async () => {
    const sections = [REASONING, { ...REASONING, index: 1, name: "Calculation" }];
    render(<MockReview review={REVIEW} sections={sections} trueFalseLabels="trueFalse" />);

    await expect.element(row(4)).toBeVisible();
    expect(row(4).element().textContent).toMatch(/Question 4 of 10.+Reasoning/u);
  });

  it("opens a row in place to its passage, both answers and why, moving no row above it", async () => {
    render(<MockReview review={REVIEW} sections={[]} trueFalseLabels="trueFalse" />);

    await expect.element(row(7)).toBeVisible();
    const before = { first: top(4), pressed: top(7) };

    await row(7).click();

    await expect.element(page.getByText("Passage for question 7.")).toBeVisible();
    await expect.element(page.getByText("Why question 7 went wrong.")).toBeVisible();

    const answers = page.getByRole("group", { name: "Your answer and the right one" });

    await expect.element(answers.getByText("The picked option")).toBeVisible();
    await expect.element(answers.getByText("The right option")).toBeVisible();
    await expect.element(answers.getByText("Your answer", { exact: true })).toBeInTheDocument();
    await expect.element(page.getByText("Why question 4 went wrong.")).not.toBeInTheDocument();

    expect({ first: top(4), pressed: top(7) }).toStrictEqual(before);
  });

  it("says on its row that a question was left blank, and shows only the right answer", async () => {
    render(<MockReview review={REVIEW} sections={[]} trueFalseLabels="trueFalse" />);

    await expect.element(row(9)).toBeVisible();

    expect(row(9).element().textContent).toMatch(/Question 9.+Languages.+Blank$/u);
    expect(row(4).element().textContent).not.toMatch(/Blank/u);

    await row(9).click();

    const answers = page.getByRole("group", { name: "Your answer and the right one" });

    await expect.element(answers.getByText("The right option")).toBeVisible();
    await expect.element(answers.getByText("Your answer")).not.toBeInTheDocument();
  });

  it("ends a row the learner wasn't sure of with it, and shows a right one's answer once", async () => {
    const review = [
      entry({ number: 4, unsure: true }),
      entry({ learnerAnswer: "The right option", number: 8, outcome: "right", unsure: true }),
    ];

    render(<MockReview review={review} sections={[]} trueFalseLabels="trueFalse" />);

    await expect.element(row(8)).toBeVisible();

    expect(row(4).element().textContent).toMatch(/Question 4 of 10.+Languages.+Wrong.+Not sure$/u);
    expect(row(8).element().textContent).toMatch(/Question 8 of 10.+Languages.+Right.+Not sure$/u);

    await row(8).click();

    const answers = page.getByRole("group", { name: "Your answer and the right one" });

    await expect.element(answers.getByText("The right option")).toBeVisible();
    expect(answers.element().textContent?.match(/The right option/gu)).toHaveLength(1);
  });

  it("shows a right typed answer as the learner wrote it, since the key may accept others", async () => {
    const review = [
      entry({
        correctAnswer: "0.5",
        format: "typed",
        learnerAnswer: "1/2",
        number: 6,
        outcome: "right",
        unsure: true,
      }),
    ];

    render(<MockReview review={review} sections={[]} trueFalseLabels="trueFalse" />);

    await row(6).click();

    const answers = page.getByRole("group", { name: "Your answer and the right one" });

    await expect.element(answers.getByText("1/2")).toBeVisible();
    await expect.element(answers.getByText("0.5")).not.toBeInTheDocument();
  });

  it("draws nothing when every answer was right", async () => {
    const { container } = render(
      <MockReview review={[]} sections={[]} trueFalseLabels="trueFalse" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

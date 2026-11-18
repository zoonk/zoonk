import { type MockResult } from "@zoonk/core/exams/mocks/contract";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { MockResultBreakdown } from "../../../learn/src/mock/mock-result-breakdown";
import { render } from "../_test-utils/render";

const TOPICS = [1, 2, 3, 4, 5, 6].map((index) => ({
  area: null,
  correct: index,
  name: `Topic ${index}`,
  skillId: `skill-${index}`,
  total: 6,
}));

const RESULT: MockResult = {
  areas: [],
  blank: 0,
  calibration: null,
  coherence: null,
  correct: 21,
  irt: null,
  minutesUsed: 10,
  net: null,
  plannedMinutes: 10,
  preparation: null,
  previous: null,
  scoring: "raw",
  topics: TOPICS,
  total: 36,
  unansweredAtTimeout: 0,
};

const topicRow = (name: string) => page.getByRole("listitem").filter({ hasText: name });

describe("the mock result's topics", () => {
  it("moves focus to the first topic it reveals, so reading on starts with its score", async () => {
    render(<MockResultBreakdown result={RESULT} />);

    await expect.element(topicRow("Topic 6")).not.toBeInTheDocument();

    page.getByRole("button", { name: "1 more topic" }).element().focus();
    await userEvent.keyboard("{Enter}");

    await expect.element(topicRow("Topic 6")).toHaveFocus();
  });

  it("keeps the divider between the last shown topic and the first revealed one", async () => {
    render(<MockResultBreakdown result={RESULT} />);

    await page.getByRole("button", { name: "1 more topic" }).click();
    await expect.element(topicRow("Topic 6")).toBeVisible();

    const border = (name: string) => getComputedStyle(topicRow(name).element()).borderBottomWidth;

    expect(border("Topic 5")).toBe("1px");
    expect(border("Topic 6")).toBe("0px");
  });
});

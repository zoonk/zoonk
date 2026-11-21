import { LearnProvider } from "@zoonk/learn/provider";
import { QuestionBlock } from "@zoonk/learn/session/block";
import { type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../_test-utils/render";

type Detail = ComponentProps<typeof QuestionBlock>["detail"];

const STATEMENT = [
  "This program keeps only the names with more than three scores:",
  "",
  "```python",
  "totals = {name: sum(scores) for name, scores in results.items() if len(scores) > 3 and name.isalpha()}",
  "print(totals)",
  "```",
].join("\n");

const DETAIL: Detail = {
  block: {
    answered: 0,
    areaId: null,
    areas: [],
    brainPower: 0,
    canDo: null,
    canTestOut: false,
    capsules: [],
    chapterId: null,
    checkpoint: null,
    estimatedBrainPower: 10,
    estimatedMinutes: 4,
    extra: false,
    fullReview: false,
    id: "block",
    kind: "practice",
    lessonId: null,
    mistakesOnly: false,
    netScored: false,
    oftenTested: false,
    opensInPlayer: false,
    planItemId: null,
    planItemKey: null,
    position: 0,
    questions: 1,
    refresh: false,
    reinforcement: false,
    screen: "session",
    status: "active",
    subject: null,
    title: null,
    topics: [],
    waitReason: null,
    weakest: false,
  },
  hints: true,
  questions: [
    {
      answered: null,
      capsuleKey: null,
      citation: null,
      context: null,
      drill: null,
      entry: null,
      format: "trueFalse",
      image: null,
      itemId: "statement",
      left: null,
      mistakeId: null,
      options: null,
      placement: false,
      question: STATEMENT,
      quoted: false,
      right: null,
      select: null,
      set: null,
      skillId: "skill",
      unit: null,
      visual: null,
    },
  ],
  trueFalseLabels: "trueFalse",
};

function openStatement() {
  render(
    <LearnProvider
      adapters={{
        analytics: { track: vi.fn() },
        linkComponent: ({ children, href, ...props }) => (
          <a href={href} {...props}>
            {children}
          </a>
        ),
        loadCountries: async () => [],
        routes: {
          buddy: "/buddy",
          journey: "/plan",
          signUp: "/login",
          today: "/today",
          upgrade: "/plus",
        },
      }}
    >
      <QuestionBlock
        actions={{
          answer: vi.fn(),
          continueSession: vi.fn(),
          finish: vi.fn(),
          refresh: vi.fn(),
          stop: vi.fn(),
        }}
        detail={DETAIL}
        exitHref="/today"
        session={{
          blocks: [],
          id: "session",
          minutes: { dailyGoal: 10, done: 0, left: 10, planned: 10 },
        }}
      />
    </LearnProvider>,
  );
}

describe("a true or false statement that holds a program", () => {
  it("scrolls the program and picks no answer", async () => {
    openStatement();

    const scroller = page.getByRole("group", { name: "Code" });
    await expect.element(scroller).toBeVisible();
    await expect.poll(() => scroller.element().getAttribute("tabindex")).toBe("0");

    await userEvent.click(scroller);
    await userEvent.keyboard("{End}");

    await expect.poll(() => scroller.element().scrollLeft).toBeGreaterThan(0);
    await expect.element(page.getByRole("radio", { name: "True" })).not.toBeChecked();
    await expect.element(page.getByRole("radio", { name: "False" })).not.toBeChecked();
  });
});

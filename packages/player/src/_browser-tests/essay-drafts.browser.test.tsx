import { type EssayDraft, type EssayView } from "@zoonk/core/exams/essays/contract";
import { type EssayActions, EssayScreen } from "@zoonk/learn/essay";
import { LearnProvider } from "@zoonk/learn/provider";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../_test-utils/render";

const ESSAY: EssayView = {
  blockId: "essay-block",
  context: null,
  drafts: [],
  gradesLeft: 3,
  question: "Should cities charge cars to enter the center?",
  rubric: "custom",
  sessionId: "session",
  status: "pending",
};

const LEARN_ADAPTERS: React.ComponentProps<typeof LearnProvider>["adapters"] = {
  analytics: { track: vi.fn() },
  linkComponent: ({ children, className, href }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  routes: { buddy: "/buddy", journey: "/plan", signUp: "/login", today: "/", upgrade: "/plus" },
};

function gradedDraft(text: string): EssayDraft {
  return {
    grade: {
      criteria: [
        {
          comment: "Clear position.",
          example: null,
          id: "criterion-1",
          maxScore: 10,
          name: "Position",
          quote: null,
          score: 6,
        },
      ],
      enemInterventionElements: null,
      nextStep: { criterionId: "criterion-1", text: "Answer the strongest objection." },
      range: { high: 7, low: 5 },
      total: { maxScore: 10, score: 6 },
      zeroReason: null,
    },
    submittedAt: new Date().toISOString(),
    text,
  };
}

function renderEssay(submit: EssayActions["submit"]) {
  render(
    <LearnProvider adapters={LEARN_ADAPTERS}>
      <EssayScreen
        actions={{ finish: vi.fn(async () => true), submit }}
        essay={ESSAY}
        hrefs={{ dailyLimit: "/settings/appearance", exit: "/today" }}
      />
    </LearnProvider>,
  );
}

const answer = () => page.getByRole("textbox", { name: "Your answer" });

const rewrite = () => page.getByRole("textbox", { name: "Rewrite what needs work" });

async function openRewrite(): Promise<void> {
  const button = page.getByRole("button", { exact: true, name: "Rewrite" });

  if (button.query()) {
    await button.click();
    return;
  }

  await page.getByRole("button", { name: "Continue" }).click();
  await openRewrite();
}

describe("an essay sent for grading", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("says when the daily time limit stops the send, links to the limit, and keeps the text", async () => {
    renderEssay(async () => "dailyLimitReached");

    await userEvent.type(answer(), "Charging cars clears the air.");
    await page.getByRole("button", { name: "Send for grading" }).click();

    await expect
      .element(page.getByText("You've reached your daily time limit. Your text stays here."))
      .toBeVisible();

    await expect
      .element(page.getByRole("link", { name: "Change limit" }))
      .toHaveAttribute("href", "/settings/appearance");

    await expect.element(answer()).toHaveValue("Charging cars clears the air.");
  });

  it("keeps what the learner typed while it was graded, on the screen and on the device", async () => {
    const graded = Promise.withResolvers<EssayDraft>();
    renderEssay(() => graded.promise);

    await userEvent.type(answer(), "Charging cars clears the air.");
    await page.getByRole("button", { name: "Send for grading" }).click();
    await expect.element(page.getByRole("button", { name: "Grading…" })).toBeDisabled();

    await userEvent.type(answer(), " It also funds buses.");
    graded.resolve(gradedDraft("Charging cars clears the air."));

    await expect.element(page.getByRole("button", { name: "Grade the rewrite" })).toBeEnabled();

    await expect
      .element(rewrite())
      .toHaveValue("Charging cars clears the air. It also funds buses.");

    expect(localStorage.getItem(`essay:${ESSAY.blockId}`)).toBe(
      "Charging cars clears the air. It also funds buses.",
    );
  });

  it("keeps a rewrite's newer text and its grading after a look at the last grade", async () => {
    const graded = Promise.withResolvers<EssayDraft>();

    renderEssay(
      vi
        .fn<EssayActions["submit"]>()
        .mockImplementationOnce(async ({ text }) => gradedDraft(text))
        .mockImplementationOnce(() => graded.promise),
    );

    await userEvent.type(answer(), "Charging cars clears the air.");
    await page.getByRole("button", { name: "Send for grading" }).click();
    await openRewrite();
    await userEvent.fill(rewrite(), "Charging cars clears the air. It also funds buses.");
    await page.getByRole("button", { name: "Grade the rewrite" }).click();

    await page.getByRole("button", { name: "See the grade" }).click();
    await openRewrite();
    await expect.element(page.getByRole("button", { name: "Grading…" })).toBeDisabled();

    await userEvent.fill(
      rewrite(),
      "Charging cars clears the air. It also funds buses. And it saves time.",
    );

    graded.resolve(gradedDraft("Charging cars clears the air. It also funds buses."));

    await expect.element(page.getByRole("button", { name: "Grade the rewrite" })).toBeEnabled();

    await expect
      .element(rewrite())
      .toHaveValue("Charging cars clears the air. It also funds buses. And it saves time.");

    expect(localStorage.getItem(`essay:${ESSAY.blockId}`)).toBe(
      "Charging cars clears the air. It also funds buses. And it saves time.",
    );
  });

  it("times a rewrite typed while its draft was graded from its own first edit", async () => {
    const minute = 60_000;
    let now = 0;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const graded = Promise.withResolvers<EssayDraft>();

    const submit = vi
      .fn<EssayActions["submit"]>()
      .mockImplementationOnce(() => graded.promise)
      .mockImplementationOnce(async ({ text }) => gradedDraft(text));

    renderEssay(submit);

    await userEvent.type(answer(), "Charging cars clears the air.");
    now = 20 * minute;
    await page.getByRole("button", { name: "Send for grading" }).click();

    now = 21 * minute;
    await userEvent.type(answer(), " It also funds buses.");
    graded.resolve(gradedDraft("Charging cars clears the air."));
    await expect.element(page.getByRole("button", { name: "Grade the rewrite" })).toBeEnabled();

    now = 26 * minute;
    await page.getByRole("button", { name: "Grade the rewrite" }).click();

    expect(submit.mock.calls.map(([input]) => input.durationMs)).toStrictEqual([
      20 * minute,
      5 * minute,
    ]);
  });

  it("shows the grade and forgets the device copy when nothing changed while it was graded", async () => {
    renderEssay(async ({ text }) => gradedDraft(text));

    await userEvent.type(answer(), "Charging cars clears the air.");
    await page.getByRole("button", { name: "Send for grading" }).click();

    await expect.element(page.getByText("Estimated score, from 0 to 10")).toBeVisible();
    expect(localStorage.getItem(`essay:${ESSAY.blockId}`)).toBeNull();
  });
});

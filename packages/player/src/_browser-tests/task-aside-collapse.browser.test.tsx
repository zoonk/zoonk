import { EssayScreen } from "@zoonk/learn/essay";
import { LearnProvider } from "@zoonk/learn/provider";
import { SessionSummary } from "@zoonk/learn/session/summary";
import { playableStepContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { SIDEBAR_STATE } from "@zoonk/ui/components/sidebar";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { atViewport } from "../_test-utils/browser-viewport";
import { render } from "../_test-utils/render";
import { renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { stubTutorApi } from "../_test-utils/tutor-api";
import { buildTutor } from "../_test-utils/tutor-config";
import { buildLesson } from "../preview/preview-lesson";
import { contentStep, explanationStep, teachingStep } from "../preview/preview-steps";

function aside() {
  return page.getByRole("complementary", { name: "Help with this screen" });
}

function showsRecapRow(): boolean {
  return document.querySelector('[data-slot="lesson-recap-row"]')?.checkVisibility() ?? false;
}

function playQuestion() {
  const lesson = buildLesson([
    explanationStep(playableStepContent.explanation),
    contentStep("check", { content: playableStepContent.check }),
  ]);

  stubTutorApi({ lesson });
  renderLessonPlayer({ lesson, tutor: buildTutor() });
}

const SUPPORTING_TEXT = "Cities that charge cars to enter their center see less traffic. ".repeat(
  8,
);

const LEARN_ADAPTERS: React.ComponentProps<typeof LearnProvider>["adapters"] = {
  analytics: { track: vi.fn() },
  linkComponent: ({ children, className, href }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  loadCountries: async () => [],
  routes: { buddy: "/buddy", journey: "/plan", signUp: "/login", today: "/", upgrade: "/plus" },
};

function renderEssay() {
  return render(
    <LearnProvider adapters={LEARN_ADAPTERS}>
      <EssayScreen
        actions={{ finish: vi.fn(async () => true), submit: vi.fn() }}
        essay={{
          blockId: "essay-block",
          context: SUPPORTING_TEXT,
          drafts: [],
          gradesLeft: 3,
          question: "Should cities charge cars to enter the center?",
          rubric: "custom",
          sessionId: "session",
          status: "pending",
        }}
        hrefs={{ exit: "/today" }}
      />
    </LearnProvider>,
  );
}

const NO_CHANGE = { after: null, before: null };

function renderSessionSummary() {
  render(
    <LearnProvider adapters={LEARN_ADAPTERS}>
      <SessionSummary
        actions={{ addExtraTime: vi.fn(), keepGoing: vi.fn(), refresh: vi.fn() }}
        buddy={null}
        exitHref="/today"
        goalKind="learn"
        summary={{
          accuracy: 1,
          belt: null,
          bestStreak: 4,
          brainPower: 10,
          buddyAte: { fixes: 0, newIdeas: 0, reviews: 0 },
          capsulesSealed: [],
          ceremony: null,
          certificates: [],
          comesBack: [],
          correct: 4,
          energy: null,
          extraTime: { available: false, lessons: [], minutes: 0, reason: "nothingToStudy" },
          finished: true,
          fullMeal: false,
          minutes: 2,
          missions: [],
          mistakesSaved: 0,
          netScore: null,
          newCards: [],
          preparation: NO_CHANGE,
          progress: NO_CHANGE,
          questions: 4,
          sessionId: "session",
          skillsMoved: [],
          status: "completed",
          tomorrow: null,
          topHyperdrive: 0,
        }}
      />
    </LearnProvider>,
  );
}

function stepTitle() {
  return document.querySelector('[data-slot="steps-step"] [data-slot="step-title"]');
}

function shownStreaks(): number {
  return [...document.querySelectorAll("span")].filter(
    (span) => span.textContent === "4 right in a row" && span.checkVisibility(),
  ).length;
}

describe("collapsing a task's sidebar", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(SIDEBAR_STATE.end.attribute);
    localStorage.removeItem(SIDEBAR_STATE.end.key);
  });

  it("moves what it holds into the lesson and remembers the choice", async () => {
    playQuestion();
    await page.getByRole("button", { name: /^Next/u }).click();

    await expect.element(aside()).toBeVisible();
    await expect.element(aside().getByText("From the lesson")).toBeVisible();
    await expect.poll(showsRecapRow).toBe(false);
    expect(page.getByRole("button", { name: "Ask Pip" }).query()).toBeNull();

    await page.getByRole("button", { name: "Collapse sidebar" }).click();

    await expect.poll(() => aside().query()).toBeNull();
    await expect.poll(showsRecapRow).toBe(true);
    await expect.element(page.getByRole("button", { name: "Ask Pip" })).toBeVisible();
    expect(localStorage.getItem(SIDEBAR_STATE.end.key)).toBe("true");

    await page.getByRole("button", { name: "Ask Pip" }).click();
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    await page.getByRole("button", { name: "Expand sidebar" }).click();

    await expect.element(aside()).toBeVisible();
    await expect.poll(showsRecapRow).toBe(false);
    expect(localStorage.getItem(SIDEBAR_STATE.end.key)).toBe("false");
  });

  it("offers the lesson map from the menu at the lesson's end while the sidebar is collapsed", async () => {
    renderLessonPlayer({
      lesson: buildLesson([teachingStep("check")], {
        summary: { ideas: [{ text: "Electrons live in clouds." }], shape: "hub" },
      }),
    });

    await page
      .getByRole("radio", { name: "Where the electron is most likely to be found" })
      .click();

    await page.getByRole("button", { name: /^Check/u }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.element(page.getByRole("heading", { name: "Lesson complete" })).toBeVisible();

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await page.getByRole("button", { name: "Screen options" }).click();
    await page.getByRole("menuitem", { name: "Lesson map" }).click();

    const map = page.getByRole("dialog", { name: "Lesson map" });
    await expect.element(map.getByText("Electrons live in clouds.")).toBeVisible();
  });

  it("keeps the choice on every task, each showing what its sidebar held in the column", async () => {
    const essay = renderEssay();
    const essayAside = page.getByRole("complementary", { name: "Supporting texts" });
    await expect.element(essayAside).toBeVisible();

    await page.getByRole("button", { name: "Collapse sidebar" }).click();

    await expect.poll(() => essayAside.query()).toBeNull();
    await expect.element(page.getByRole("heading", { name: "Supporting texts" })).toBeVisible();
    essay.unmount();

    playQuestion();
    await page.getByRole("button", { name: /^Next/u }).click();

    await expect.element(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();
    expect(aside().query()).toBeNull();
    await expect.poll(showsRecapRow).toBe(true);
  });

  it("returns the session's rewards to the sidebar when it opens again on their step, focus staying on the toggle", async () => {
    renderSessionSummary();
    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await page.getByRole("button", { name: /^Continue/u }).click();
    await expect.poll(shownStreaks).toBe(1);

    await page.getByRole("button", { name: "Expand sidebar" }).click();

    await expect.element(page.getByRole("complementary", { name: "Earned today" })).toBeVisible();
    await expect.poll(shownStreaks).toBe(1);
    await expect.element(page.getByRole("button", { name: "Collapse sidebar" })).toHaveFocus();

    await page.getByRole("button", { name: "Collapse sidebar" }).click();

    await expect.poll(() => document.querySelector('[data-slot="step-dots"]')).not.toBeNull();
    await expect.element(page.getByRole("button", { name: "Expand sidebar" })).toHaveFocus();
  });

  it("keeps focus on the session summary's heading when a wider window brings the sidebar back", async () => {
    await atViewport({ height: 720, width: 900 }, async () => {
      renderSessionSummary();
      await userEvent.keyboard("{Enter}");
      await expect.poll(shownStreaks).toBe(1);
      expect(document.activeElement).toBe(stepTitle());

      await page.viewport(1280, 720);

      await expect.poll(() => document.querySelector('[data-slot="step-dots"]')).toBeNull();
      await expect.poll(shownStreaks).toBe(1);
      await expect.poll(() => document.activeElement === stepTitle()).toBe(true);
    });
  });
});

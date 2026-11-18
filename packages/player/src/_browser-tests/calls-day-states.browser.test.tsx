import { cleanup } from "@testing-library/react";
import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { LearnProvider } from "@zoonk/learn/provider";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { type BuddyStatusView } from "../../../learn/src/buddies/buddy-status-view";
import { BuddyToday } from "../../../learn/src/buddies/buddy-today";
import { PhaseName } from "../../../learn/src/journey/path-phase-row";
import { ReasonText } from "../../../learn/src/syllabus/topic-note";
import { atViewport } from "../_test-utils/browser-viewport";
import { render } from "../_test-utils/render";

const goal = { kind: "learn" };

vi.mock("../../../learn/src/plan/plan-context", () => ({
  usePlanScreen: () => ({ goal, plan: { access: { mocksRequirePlus: false } } }),
}));

const ADAPTERS: React.ComponentProps<typeof LearnProvider>["adapters"] = {
  analytics: { track: vi.fn() },
  linkComponent: ({ children, className, href }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  loadCountries: async () => [],
  routes: { buddy: "/buddy", journey: "/plan", signUp: "/login", today: "/", upgrade: "/plus" },
};

const PHASE: PlanPhaseView = {
  challengeLeftOut: true,
  chapterCount: 1,
  chapters: [],
  checkpoint: null,
  endDate: null,
  hours: 1,
  index: 0,
  kind: "learn",
  lessonsDone: 0,
  lessonsTotal: 3,
  milestone: null,
  mocks: { count: 0, nextDate: null },
  name: "Waves",
  notPlannedReason: null,
  short: null,
  startDate: null,
  state: "current",
};

const STATUS: BuddyStatusView = {
  belt: {
    bpPerLevel: 100,
    bpToNextLevel: 40,
    color: "white",
    isMaxLevel: false,
    level: 2,
    progressInLevel: 60,
    totalBrainPower: 160,
  },
  buddy: { glasses: "round", kind: "zu", name: null, picked: true },
  energy: { current: null, state: "awake", studiedToday: false },
  firstSteps: null,
  glasses: [],
  nextStage: null,
  stage: "baby",
  thisWeek: { fixes: 0, newIdeas: 0, reviews: 0 },
  today: {
    fullMeal: { bonus: 50, earned: false },
    goalId: "goal",
    localDate: "2026-11-16",
    missions: [],
  },
};

describe("calls with partial or empty days", () => {
  afterEach(cleanup);

  it.each(["learn", "language"] as const)("names only the omitted %s event", async (kind) => {
    goal.kind = kind;
    render(<PhaseName phase={PHASE} open={false} />);

    await expect
      .element(
        page.getByText(
          kind === "language" ? "The call isn't in your plan" : "The Trickster isn't in your plan",
        ),
      )
      .toBeVisible();

    expect(page.getByText("Not in your plan · your time doesn't cover it").query()).toBeNull();
  });

  it("names a phase the learner already knows", async () => {
    render(<ReasonText reason="known" />);
    await expect.element(page.getByText("Skipped · you already know it")).toBeVisible();
  });

  it.each([390, 1440])("opens the buddy's day with no missions at %ipx", async (width) => {
    await atViewport({ height: 900, width }, async () => {
      render(
        <LearnProvider adapters={ADAPTERS}>
          <BuddyToday
            buddy={{ ...STATUS.buddy, beltColor: "white", energy: null, studiedToday: false }}
            energyHref="/energy"
            missionLinks={{
              hrefs: {
                areaPractice: () => "/practice",
                buddy: "/buddy",
                call: () => "/call",
                mistakesPractice: "/mistakes",
                mockChooser: "/mock",
                pattern: () => "/pattern",
                pronunciation: "/pronunciation",
              },
              openBlock: async () => true,
            }}
            name="Zu"
            status={STATUS}
          />
        </LearnProvider>,
      );

      await page.getByRole("button", { exact: true, name: "Zu today" }).click();

      await expect
        .element(page.getByRole("dialog").getByRole("heading", { name: "Zu today" }))
        .toBeVisible();

      await expect.element(page.getByRole("dialog").getByText("Fully grown")).toBeVisible();
    });
  });
});

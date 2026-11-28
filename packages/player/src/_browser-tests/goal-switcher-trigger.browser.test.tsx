import { GoalSwitcher } from "@zoonk/learn/goal-switcher";
import { LearnProvider } from "@zoonk/learn/provider";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "../_test-utils/render";

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

function goal(id: string, displayName: string, kind: "explain" | "learn") {
  return {
    dailyMinutes: 10,
    daysLeft: null,
    displayName,
    id,
    kind,
    languageFlag: null,
    status: "active" as const,
    targetDateEstimated: false,
    targetLanguage: null,
    targetRegion: null,
  };
}

describe("the goal menu's trigger", () => {
  it("names the quick explanations when they're all the learner has open", async () => {
    render(
      <LearnProvider adapters={ADAPTERS}>
        <GoalSwitcher
          activeGoalId={null}
          explanationHref="/explain"
          exploreHref="/courses"
          goals={[
            goal("a", "Why the sky is blue", "explain"),
            goal("b", "How tides work", "explain"),
          ]}
          hasAccount
          newGoalHref="/start"
          onSelect={vi.fn()}
          onStartWaiting={vi.fn()}
          waitingGoals={[]}
        />
      </LearnProvider>,
    );

    const trigger = page.getByRole("button", { name: "Quick explanations" });
    await expect.element(trigger).toBeVisible();
    await expect.element(page.getByText("New goal")).not.toBeInTheDocument();

    await trigger.click();
    // The test's link stand-in keeps only its address, so the menu's row reads as a link.
    await expect.element(page.getByRole("link", { name: "New goal" })).toBeVisible();
  });

  it("keeps a long goal name on one line beside the sidebar's 32px buttons", async () => {
    const name = "Learn to code from scratch and build my first web app";

    render(
      <LearnProvider adapters={ADAPTERS}>
        <div style={{ width: 224 }}>
          <GoalSwitcher
            activeGoalId="a"
            explanationHref="/explain"
            exploreHref="/courses"
            goals={[goal("a", name, "learn")]}
            hasAccount
            newGoalHref="/start"
            onSelect={vi.fn()}
            onStartWaiting={vi.fn()}
            placement="sidebar"
            waitingGoals={[]}
          />
        </div>
      </LearnProvider>,
    );

    const trigger = page.getByRole("button", { name });
    await expect.element(trigger).toHaveAttribute("title", name);
    expect(trigger.element().getBoundingClientRect().height).toBe(32);
  });
});

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

function explanation(id: string, displayName: string) {
  return {
    dailyMinutes: 10,
    displayName,
    id,
    kind: "explain" as const,
    languageFlag: null,
    status: "active" as const,
    targetDate: null,
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
          goals={[explanation("a", "Why the sky is blue"), explanation("b", "How tides work")]}
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
    await expect.element(page.getByText("Start a goal")).not.toBeInTheDocument();

    await trigger.click();
    await expect.element(page.getByRole("menuitem", { name: "Start a goal" })).toBeVisible();
  });
});

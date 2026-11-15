import { LessonNotWrittenNotice } from "@zoonk/learn/lesson-not-written";
import { LearnProvider } from "@zoonk/learn/provider";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { DroppedCallScreen } from "../../../learn/src/language/conversation/dropped-call-screen";
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

describe("a limit whose day has come", () => {
  it("offers Start the lesson for a refusal reopened after its day, as from the lesson's address", async () => {
    render(
      <LearnProvider adapters={ADAPTERS}>
        <LessonNotWrittenNotice
          linkComponent={ADAPTERS.linkComponent}
          onRetry={vi.fn()}
          reason={{
            limit: {
              availableAt: new Date(Date.now() - 60 * 1000).toISOString(),
              period: "rolling30Days",
              status: "limitReached",
              tier: "free",
            },
            status: "refused",
          }}
          routes={{ signUp: "/login", upgrade: "/plus" }}
        />
      </LearnProvider>,
    );

    await expect.element(page.getByRole("button", { name: "Start the lesson" })).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Subscribe" })).not.toBeInTheDocument();
  });

  it("says the dropped call can be made again, with no Subscribe, once its call time comes back", async () => {
    render(
      <LearnProvider adapters={ADAPTERS}>
        <DroppedCallScreen
          dropped={{ reason: "limit", retry: null }}
          limit={{
            availableAt: new Date(Date.now() + 1500).toISOString(),
            period: "rolling30Days",
            tier: "free",
          }}
          microphoneProblem={null}
          name="Linda"
          onEnd={vi.fn()}
          onRetry={vi.fn()}
          onStart={vi.fn()}
          onTakeover={vi.fn()}
          title="Practice call"
        />
      </LearnProvider>,
    );

    await expect.element(page.getByText("You've used your call time")).toBeVisible();
    await expect.element(page.getByRole("button", { name: "Call again" })).toBeVisible();
    await expect.element(page.getByText("You can try again now.")).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Subscribe" })).not.toBeInTheDocument();
    await expect.element(page.getByText("You've used your call time")).not.toBeInTheDocument();
  });
});

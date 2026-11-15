import { LessonNotWrittenNotice } from "@zoonk/learn/lesson-not-written";
import { LearnProvider } from "@zoonk/learn/provider";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { DroppedCallScreen } from "../../../learn/src/language/conversation/dropped-call-screen";
import { GoalErrorAlert } from "../../../learn/src/onboarding/entry/goal-outcomes";
import { render } from "../_test-utils/render";
import { buildAdapters, renderLessonPlayer } from "../_test-utils/render-lesson-player";
import { type LessonPlayerAdapters } from "../lesson/lesson-player-types";
import { buildLesson } from "../preview/preview-lesson";
import { teachingStep } from "../preview/preview-steps";

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

const passed = () => new Date(Date.now() - 60 * 1000).toISOString();

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
    const line = page.getByText(/subscribe to keep going\.$/u).element();

    await expect.element(page.getByRole("button", { name: "Call again" })).toBeVisible();
    await expect.element(page.getByText("You can try again now.")).toBeVisible();
    // The same notice says it: a new one in its place would be read out as a new refusal.
    expect(page.getByText("You can try again now.").element()).toBe(line);
    await expect.element(page.getByRole("link", { name: "Subscribe" })).not.toBeInTheDocument();
    await expect.element(page.getByText("You've used your call time")).not.toBeInTheDocument();
  });

  it("keeps a lesson's notice for a refusal this device received already past its day", async () => {
    render(
      <LearnProvider adapters={ADAPTERS}>
        <LessonNotWrittenNotice
          linkComponent={ADAPTERS.linkComponent}
          onRetry={vi.fn()}
          reason={{
            limit: {
              availableAt: passed(),
              period: "rolling30Days",
              receivedAt: Date.now(),
              status: "limitReached",
              tier: "free",
            },
            status: "refused",
          }}
          routes={{ signUp: "/login", upgrade: "/plus" }}
        />
      </LearnProvider>,
    );

    await expect.element(page.getByText("You've used your free lessons")).toBeVisible();
    await expect.element(page.getByRole("link", { name: "Subscribe" })).toBeVisible();

    await expect
      .element(page.getByRole("button", { name: "Start the lesson" }))
      .not.toBeInTheDocument();
  });

  it("keeps the lesson's gate when its start is refused with a day this device already shows as past", async () => {
    const lesson = buildLesson([teachingStep("check")]);

    const startLesson = vi
      .fn<LessonPlayerAdapters["startLesson"]>()
      .mockResolvedValue({
        availableAt: passed(),
        period: "rolling30Days",
        reason: "limitReached",
        tier: "free",
      });

    renderLessonPlayer({ adapters: buildAdapters(lesson, { startLesson }), lesson });

    await expect
      .element(page.getByRole("heading", { name: "You've used your free lessons" }))
      .toBeVisible();

    await expect.element(page.getByRole("link", { name: "Subscribe" })).toBeVisible();
    expect(page.getByRole("button", { name: /^Start the lesson/u }).query()).toBeNull();
  });

  it.each([
    ["received already past keeps its notice", Date.now(), 1],
    ["restored past is over", undefined, 0],
  ] as const)("a goal refusal %s", async (_name, receivedAt, shown) => {
    const availableAt = passed();

    render(
      <LearnProvider adapters={ADAPTERS}>
        <GoalErrorAlert
          error={{
            limit: { availableAt, reason: "monthlyGoals", receivedAt },
            message: {
              cap: { availableAt, period: "rolling30Days", receivedAt, tier: "free" },
              title: "You've started all the new goals you can",
            },
            needsAccount: false,
          }}
          signUpHref="/login"
        />
      </LearnProvider>,
    );

    await expect
      .poll(() => page.getByText("You've started all the new goals you can").all().length)
      .toBe(shown);
  });
});

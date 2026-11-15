import { type CallLimit } from "@zoonk/learn/help-limit";
import { LessonNotWrittenNotice } from "@zoonk/learn/lesson-not-written";
import { LearnProvider } from "@zoonk/learn/provider";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { CallProblem } from "../../../learn/src/language/conversation/call-problem";
import { DroppedCallScreen } from "../../../learn/src/language/conversation/dropped-call-screen";
import { useCallConnection } from "../../../learn/src/language/conversation/use-call-connection";
import { AttachControls } from "../../../learn/src/onboarding/entry/attach-panel";
import { GoalErrorAlert } from "../../../learn/src/onboarding/entry/goal-outcomes";
import { MaterialQuestions } from "../../../learn/src/onboarding/entry/material-questions";
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

/** A refusal from a request just made, with more coming back in a moment. */
const refusedSoon = () => ({
  availableAt: new Date(Date.now() + 4000).toISOString(),
  period: "rolling30Days" as const,
  receivedAt: Date.now(),
  status: "limitReached" as const,
  tier: "free" as const,
});

function RefusedUpload() {
  return (
    <AttachControls
      attach={{ file: vi.fn(), link: vi.fn(), text: async () => refusedSoon() }}
      language="en"
      onAttached={vi.fn()}
    />
  );
}

function RefusedQuestion() {
  return (
    <MaterialQuestions
      ask={async () => refusedSoon()}
      buddy={null}
      sources={[{ id: "s1", title: "Notes" }]}
    />
  );
}

/** A call whose reservation is refused with a day this device's clock already shows as past. */
function RefusedCall({ first }: { first: boolean }) {
  const [limit, setLimit] = useState<CallLimit | null>(null);

  const connection = useCallConnection({
    connect: async () => ({
      limit: { availableAt: passed(), period: "rolling30Days", tier: "free" },
      status: "limit",
    }),
    end: async () => ({ endedAtDeadline: false, status: "closed" }),
  });

  const call = async () => {
    const answer = await connection.reserve({ isCurrent: () => true, takeover: false });

    if (answer?.status === "limit") {
      setLimit(answer.limit);
    }
  };

  if (first) {
    return limit ? (
      <CallProblem
        error="limit"
        exitHref="/"
        limit={limit}
        onRetry={() => void call()}
        onTakeover={vi.fn()}
        title="Practice call"
      />
    ) : (
      <button onClick={() => void call()} type="button">
        Call Linda
      </button>
    );
  }

  return (
    <DroppedCallScreen
      dropped={limit ? { reason: "limit", retry: null } : { reason: null, retry: "callAgain" }}
      limit={limit}
      microphoneProblem={null}
      name="Linda"
      onEnd={vi.fn()}
      onRetry={() => void call()}
      onStart={vi.fn()}
      onTakeover={vi.fn()}
      title="Practice call"
    />
  );
}

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

  it.each([
    ["a dropped call's Call again", false, "Call again"],
    ["the first connection", true, "Call Linda"],
  ] as const)(
    "keeps the call-time notice when %s is refused with a day this device already shows as past",
    async (_name, first, press) => {
      render(
        <LearnProvider adapters={ADAPTERS}>
          <RefusedCall first={first} />
        </LearnProvider>,
      );

      await page.getByRole("button", { name: press }).click();

      await expect.element(page.getByText("You've used your call time")).toBeVisible();
      await expect.element(page.getByRole("link", { name: "Subscribe" })).toBeVisible();
      await expect.element(page.getByText("You can try again now.")).not.toBeInTheDocument();
    },
  );

  it.each([
    ["an upload", RefusedUpload, "You've used your uploads", "Paste text", "Add text"],
    ["a question about the material", RefusedQuestion, "You've used your questions", null, "Ask"],
  ] as const)(
    "a refused %s says when more comes back with Subscribe, then only that it can be tried again",
    async (_name, Screen, title, open, send) => {
      render(
        <LearnProvider adapters={ADAPTERS}>
          <Screen />
        </LearnProvider>,
      );

      if (open) {
        await page.getByRole("button", { name: open }).click();
      }

      await page.getByRole("textbox").fill("My notes on cells");
      await page.getByRole("button", { exact: true, name: send }).click();

      await expect.element(page.getByText(title)).toBeVisible();
      await expect.element(page.getByText(/subscribe to keep going\.$/u)).toBeVisible();
      await expect.element(page.getByRole("link", { name: "Subscribe" })).toBeVisible();

      await expect.element(page.getByText("You can try again now.")).toBeVisible();
      await expect.element(page.getByText(title)).not.toBeInTheDocument();
      await expect.element(page.getByRole("link", { name: "Subscribe" })).not.toBeInTheDocument();
    },
  );
});

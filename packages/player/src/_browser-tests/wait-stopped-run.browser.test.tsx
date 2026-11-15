import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import {
  type FollowedRunProps,
  GenerationFollowerProvider,
} from "@zoonk/learn/generation/follower";
import { type GenerationRun } from "@zoonk/learn/generation/run";
import { LearnProvider } from "@zoonk/learn/provider";
import { NextStop, type NextStopActions } from "@zoonk/learn/session/next-stop";
import { type DayStep } from "@zoonk/learn/session/types";
import { createContext, use } from "react";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import { page } from "vitest/browser";
import { PlacementWaiting } from "../../../learn/src/onboarding/steps/placement-waiting";
import { focusOn, press } from "../_test-utils/activity-player";
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

const QUESTION = "Which gas do plants take in?";

/** Each test its own deck: the device remembers a deck once read, and where its quiz got to. */
const newDeck = (): WarmUpDeck => ({
  cards: [QUESTION, "Which part of a plant makes food?"].map((question, index) => ({
    id: `card-${index}`,
    options: [
      { correct: true, id: "a", text: "Carbon dioxide" },
      { correct: false, id: "b", text: "Helium" },
    ],
    question,
    reveal: "Plants take in carbon dioxide.",
  })),
  id: crypto.randomUUID(),
  language: "en",
});

const BLOCK = {
  estimatedMinutes: 6,
  kind: "learn",
  lessonId: crypto.randomUUID(),
  position: 2,
  title: "Photosynthesis",
} as DayStep;

const RUNNING: GenerationRun = {
  failure: null,
  status: "following",
  steps: { planLesson: "started" },
};

const STOPPED: GenerationRun = {
  ...RUNNING,
  failure: "generation",
  retry: vi.fn(),
  status: "failed",
};

const PAUSED: GenerationRun = { ...STOPPED, failure: "connection" };

const RunContext = createContext<GenerationRun>(RUNNING);

function FakeFollower({ children }: FollowedRunProps) {
  return children(use(RunContext));
}

function UpNext({
  deck,
  generationId = "run-1",
  lesson = "writing",
  run,
}: {
  deck: WarmUpDeck;
  generationId?: string;
  lesson?: "failed" | "writing";
  run: GenerationRun;
}) {
  const actions: NextStopActions = {
    refresh: vi.fn(),
    start: vi.fn(async () => true),
    stop: vi.fn(async () => true),
  };

  return (
    <LearnProvider adapters={ADAPTERS}>
      <GenerationFollowerProvider follower={FakeFollower}>
        <RunContext value={run}>
          <NextStop
            actions={actions}
            alternative={null}
            block={BLOCK}
            blocks={[BLOCK]}
            exitHref="/"
            generationId={generationId}
            goalId="goal"
            lesson={lesson}
            minutesLeft={20}
            notWritten={null}
            sessionBar={{ completed: 1, total: 3 }}
            warmUp={deck}
          />
        </RunContext>
      </GenerationFollowerProvider>
    </LearnProvider>
  );
}

function Placement({ deck, run }: { deck: WarmUpDeck; run: GenerationRun }) {
  return (
    <LearnProvider adapters={ADAPTERS}>
      <PlacementWaiting
        buildFailed={false}
        onQuestions={vi.fn()}
        onSkip={vi.fn()}
        poll={{ restart: vi.fn(), status: "polling" }}
        questionsReady={false}
        readWarmUp={async () => deck}
        run={{ ...run, warmUpId: deck.id }}
        skipping={false}
      />
    </LearnProvider>
  );
}

/** Just past the ten minutes a lesson's writing may take without the wait calling it stuck. */
const WENT_QUIET_MS = 600_001;

const question = () => page.getByText(QUESTION);
const helium = () => page.getByRole("radio", { name: /Helium/u });

const picked = () => page.getByRole("radio", { checked: true });

/** The learner was mid-question, or had already answered it, when the run stopped. */
async function reach(state: "answered" | "midQuestion") {
  if (state === "answered") {
    await helium().click();
  }

  await expect.element(helium()).toHaveAttribute("aria-checked", String(state === "answered"));
}

describe("a wait whose run stops takes the quiz away whole", () => {
  it.each(["midQuestion", "answered"] as const)(
    "Up next, as soon as the followed run stops, before the session's snapshot does: %s",
    async (state) => {
      const deck = newDeck();
      const view = render(<UpNext deck={deck} run={RUNNING} />);
      await expect.element(question()).toBeVisible();
      await reach(state);

      view.rerender(<UpNext deck={deck} run={PAUSED} />);
      await expect.element(question()).toBeVisible();

      view.rerender(<UpNext deck={deck} run={STOPPED} />);
      await expect.element(page.getByRole("button", { name: "Try again" })).toBeVisible();
      await expect.element(question()).not.toBeInTheDocument();
      await expect.element(helium()).not.toBeInTheDocument();

      await page.getByRole("button", { name: "Try again" }).click();
      view.rerender(<UpNext deck={deck} generationId="run-2" run={RUNNING} />);

      // A fresh quiz: a card with nothing picked, wherever the deck had got to.
      await expect.element(page.getByRole("radiogroup")).toBeVisible();
      await expect.element(picked()).not.toBeInTheDocument();
    },
  );

  it("Up next gives a run that went quiet a clean start: after Try again, and for a new run", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });

    onTestFinished(() => {
      vi.useRealTimers();
    });

    const deck = newDeck();
    const view = render(<UpNext deck={deck} run={RUNNING} />);
    await expect.element(question()).toBeVisible();

    // Ten minutes of writing with nothing new from the run: the wait says it didn't work.
    await vi.advanceTimersByTimeAsync(WENT_QUIET_MS);
    await expect.element(question()).not.toBeInTheDocument();

    // A press, not a click: a click lets the fake clock run on.
    await focusOn(page.getByRole("button", { name: "Try again" }));
    await press("Enter");
    await expect.element(question()).toBeVisible();

    await vi.advanceTimersByTimeAsync(WENT_QUIET_MS);
    await expect.element(question()).not.toBeInTheDocument();

    view.rerender(<UpNext deck={deck} generationId="run-2" run={RUNNING} />);
    await expect.element(question()).toBeVisible();
  });

  it.each(["midQuestion", "answered"] as const)(
    "the placement wait, once its run stops, and not when only the connection drops: %s",
    async (state) => {
      const deck = newDeck();
      const view = render(<Placement deck={deck} run={RUNNING} />);
      await expect.element(question()).toBeVisible();
      await reach(state);

      view.rerender(<Placement deck={deck} run={PAUSED} />);
      await expect.element(question()).toBeVisible();

      view.rerender(<Placement deck={deck} run={STOPPED} />);
      await expect.element(page.getByText("Something went wrong on our side")).toBeVisible();
      await expect.element(question()).not.toBeInTheDocument();
      await expect.element(helium()).not.toBeInTheDocument();
    },
  );
});

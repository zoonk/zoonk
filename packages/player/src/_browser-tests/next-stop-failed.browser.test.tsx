import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/warm-up-contract";
import { LearnProvider } from "@zoonk/learn/provider";
import { NextStop, type NextStopActions } from "@zoonk/learn/session/next-stop";
import { type DayStep } from "@zoonk/learn/session/types";
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

const QUESTION = "Which gas do plants take in?";

const DECK: WarmUpDeck = {
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
};

const BLOCK = {
  estimatedMinutes: 6,
  kind: "learn",
  lessonId: crypto.randomUUID(),
  position: 2,
  title: "Photosynthesis",
} as DayStep;

const ACTIONS: NextStopActions = {
  refresh: vi.fn(),
  start: vi.fn(async () => true),
  stop: vi.fn(async () => true),
};

describe("the next stop's wait for a lesson whose writing failed", () => {
  it("offers Try again and no quiz, since nothing is being waited for", async () => {
    render(
      <LearnProvider adapters={ADAPTERS}>
        <NextStop
          actions={ACTIONS}
          alternative={null}
          block={BLOCK}
          blocks={[BLOCK]}
          exitHref="/"
          generationId={null}
          goalId={crypto.randomUUID()}
          lesson="failed"
          minutesLeft={20}
          notWritten={null}
          sessionBar={{ completed: 1, total: 3 }}
          warmUp={DECK}
        />
      </LearnProvider>,
    );

    await expect.element(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect.element(page.getByText(QUESTION)).not.toBeInTheDocument();

    await expect
      .element(page.getByRole("button", { name: "Play a quiz while you wait" }))
      .not.toBeInTheDocument();
  });
});

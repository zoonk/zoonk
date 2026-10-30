import { type TutorToolOffer } from "@zoonk/core/lesson-questions/contract";
import { LearnProvider } from "@zoonk/learn/provider";
import { type TutorCardActions, getTutorCards } from "@zoonk/learn/tutor-cards";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "../_test-utils/render";

type CallOffer = Extract<TutorToolOffer, { kind: "conversationCall" }>;

const LEARN_ADAPTERS: React.ComponentProps<typeof LearnProvider>["adapters"] = {
  analytics: { track: vi.fn() },
  linkComponent: ({ children, className, href }) => (
    <a className={className} href={href}>
      {children}
    </a>
  ),
  routes: { buddy: "/buddy", journey: "/plan", signUp: "/login", today: "/", upgrade: "/plus" },
};

const OFFERED_CALL: CallOffer = {
  call: {
    character: { name: "Ana", role: "recruiter" },
    defaultMinutes: 2,
    limit: null,
    minutes: [1, 2, 3, 5],
    paused: false,
    plusMinutes: [],
  },
  chapterId: "01a11014-0000-7000-8000-000000000002",
  goalId: "01a11014-0000-7000-8000-00000000000a",
  kind: "conversationCall",
  unitTitle: "Talking about your projects",
};

function renderOffer(offer: CallOffer) {
  const startConversation = vi.fn<TutorCardActions["tools"]["startConversation"]>(async () => true);

  const tools: TutorCardActions["tools"] = {
    hrefs: {
      chooseFocus: "/focus",
      chooseMock: "/mock",
      course: () => "/course",
      logbook: "/logbook",
      memory: "/memory",
      mistakes: "/mistakes",
      pronunciation: "/pronunciation",
      startGoal: () => "/start",
      stats: "/stats",
      subject: () => "/subject",
    },
    startConversation,
    startTestOut: vi.fn(),
  };

  const cards = getTutorCards({ decide: vi.fn(), tools });

  render(<LearnProvider adapters={LEARN_ADAPTERS}>{cards.renderToolOffer(offer)}</LearnProvider>);

  return startConversation;
}

describe("the tutor's call offer", () => {
  it("names the call once, and its one button opens the length choice that starts it", async () => {
    const startConversation = renderOffer(OFFERED_CALL);

    await expect.element(page.getByText("Talking about your projects")).toBeVisible();

    await expect
      .element(page.getByText("A short call out loud with Ana, recruiter."))
      .toBeVisible();

    await expect.element(page.getByText("with Ana · recruiter")).not.toBeInTheDocument();

    await page.getByRole("button", { name: "Practice" }).click();

    await expect
      .element(page.getByRole("dialog", { name: "Practice a conversation" }))
      .toBeVisible();

    await page.getByRole("button", { name: "Start the call" }).click();

    await expect
      .poll(() => startConversation.mock.calls)
      .toStrictEqual([
        [{ chapterId: OFFERED_CALL.chapterId, goalId: OFFERED_CALL.goalId, minutes: 2 }],
      ]);
  });

  it("says calls are paused, with nothing to tap", async () => {
    renderOffer({ ...OFFERED_CALL, call: { ...OFFERED_CALL.call, paused: true } });

    await expect
      .element(page.getByText("Calls are paused for everyone right now. Try again later."))
      .toBeVisible();

    await expect.element(page.getByRole("button", { name: "Practice" })).not.toBeInTheDocument();
  });
});

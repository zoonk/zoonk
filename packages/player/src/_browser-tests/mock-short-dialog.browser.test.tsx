import { type MockOptionView, type MockOptionsView } from "@zoonk/core/exams/mocks/contract";
import { MockChooserScreen, getMockOptionKey } from "@zoonk/learn/mock/chooser";
import { LearnProvider } from "@zoonk/learn/provider";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "../_test-utils/render";

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

const FULL_MOCK: MockOptionView = {
  area: null,
  areas: [],
  covers: null,
  day: null,
  estimatedMinutes: 20,
  kind: "full",
  leftOut: [],
  minutes: 20,
  objectiveOnly: false,
  questions: 20,
  written: [],
};

const VIEW: MockOptionsView = {
  access: "open",
  examDocument: "notice",
  examName: "ENEM",
  goalId: "01a11014-0000-7000-8000-00000000000a",
  lastMock: null,
  options: [FULL_MOCK],
  running: null,
  sizeSource: {
    formats: null,
    material: false,
    pastEdition: null,
    questions: "notice",
    subjects: null,
    time: "notice",
  },
};

describe("the shorter mock exam's dialog", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("names the day the full mock comes back by its month and day, even across New Year", async () => {
    vi.useFakeTimers({ now: new Date("2026-12-28T12:00:00.000Z"), toFake: ["Date"] });

    render(
      <LearnProvider adapters={LEARN_ADAPTERS}>
        <MockChooserScreen
          bar={null}
          busy={false}
          hrefs={{ mock: (id) => `/mock/${id}` }}
          onStart={vi.fn()}
          onStartShort={vi.fn()}
          onStayChoosing={vi.fn()}
          status={{
            availableAt: "2027-01-10T12:00:00.000Z",
            examQuestions: 20,
            kind: "short",
            limit: "rolling30Days",
            minutes: 10,
            optionKey: getMockOptionKey(FULL_MOCK),
            questions: 10,
          }}
          view={VIEW}
        />
      </LearnProvider>,
    );

    await expect
      .element(
        page.getByText(
          "Today this one has 10 of its 20 questions, about 10 min. You can take the full one on January 10.",
        ),
      )
      .toBeVisible();
  });
});

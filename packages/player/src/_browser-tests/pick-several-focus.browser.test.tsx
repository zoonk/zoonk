import { LearnProvider } from "@zoonk/learn/provider";
import { QuestionBlock } from "@zoonk/learn/session/block";
import { type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "../_test-utils/render";

type Detail = ComponentProps<typeof QuestionBlock>["detail"];
type OptionSelect = NonNullable<Detail["questions"][number]["select"]>;

function detail(select: OptionSelect): Detail {
  return {
    block: {
      answered: 0,
      areaId: null,
      areas: [],
      brainPower: 0,
      canDo: null,
      canTestOut: false,
      capsules: [],
      chapterId: null,
      checkpoint: null,
      estimatedBrainPower: 10,
      estimatedMinutes: 4,
      extra: false,
      fullReview: false,
      id: "block",
      kind: "practice",
      lesson: null,
      lessonId: null,
      mistakesOnly: false,
      netScored: false,
      oftenTested: false,
      opensInPlayer: false,
      planItemId: null,
      planItemKey: null,
      position: 0,
      practiceNumber: null,
      preparing: false,
      questions: 1,
      refresh: false,
      reinforcement: false,
      screen: "session",
      status: "active",
      subject: null,
      title: null,
      topics: [],
      waitReason: null,
      weakest: false,
    },
    hints: true,
    questions: [
      {
        answered: null,
        capsuleKey: null,
        citation: null,
        context: null,
        drill: null,
        entry: null,
        format: "multipleChoice",
        image: null,
        itemId: "cities",
        key: null,
        left: null,
        mistakeId: null,
        options: ["Paris", "Lyon", "Berlin", "Marseille"],
        placement: false,
        question: "Which of these cities are in France?",
        quoted: false,
        right: null,
        select,
        set: null,
        skillId: "skill",
        unit: null,
        visual: null,
      },
    ],
    trueFalseLabels: "trueFalse",
  };
}

function openQuestion(select: OptionSelect) {
  render(
    <LearnProvider
      adapters={{
        analytics: { track: vi.fn() },
        linkComponent: ({ children, href, ...props }) => (
          <a href={href} {...props}>
            {children}
          </a>
        ),
        loadCountries: async () => [],
        routes: {
          buddy: "/buddy",
          journey: "/plan",
          signUp: "/login",
          today: "/today",
          upgrade: "/plus",
        },
      }}
    >
      <QuestionBlock
        actions={{
          answer: vi.fn(),
          continueSession: vi.fn(),
          finish: vi.fn(),
          refresh: vi.fn(),
          stop: vi.fn(),
        }}
        blocks={[]}
        detail={detail(select)}
        exitHref="/today"
      />
    </LearnProvider>,
  );
}

describe("a question that takes several answers", () => {
  it("keeps the keyboard on the options after a pick when every right one counts", async () => {
    openQuestion("all");

    const paris = page.getByRole("checkbox", { name: "Paris" });
    await expect.element(paris).toBeVisible();

    paris.element().focus();
    await userEvent.keyboard(" ");

    await expect.element(paris).toBeChecked();
    await expect.element(paris).toHaveFocus();

    await userEvent.tab();
    await expect.element(page.getByRole("checkbox", { name: "Lyon" })).toHaveFocus();
  });

  it("moves the keyboard to the main action once the asked number is picked", async () => {
    openQuestion(2);

    const paris = page.getByRole("checkbox", { name: "Paris" });
    await expect.element(paris).toBeVisible();

    paris.element().focus();
    await userEvent.keyboard(" ");
    await expect.element(paris).toHaveFocus();

    await userEvent.tab();
    await userEvent.keyboard(" ");

    await expect.element(page.getByRole("button", { name: /Check/u })).toHaveFocus();
  });
});

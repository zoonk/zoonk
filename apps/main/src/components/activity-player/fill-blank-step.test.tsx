// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, StrictMode, useCallback, useState } from "react";
import { type Mock, afterEach, describe, expect, it, vi } from "vitest";
import { FillBlankStep } from "./fill-blank-step";
import { type SelectedAnswer } from "./player-reducer";

vi.mock("next-intl", () => ({
  useExtracted: () => (value: string) => value,
}));

vi.mock("./user-name-context", () => ({
  useReplaceName: () => (value: string) => value,
}));

vi.mock("@zoonk/utils/shuffle", () => ({
  shuffle: <T,>(array: readonly T[]): T[] => [...array],
}));

function buildFillBlankStep(overrides: Record<string, unknown> = {}) {
  return {
    content: {
      answers: ["alpha", "beta"],
      distractors: ["gamma"],
      feedback: "Good",
      template: "Say [BLANK] then [BLANK]",
    },
    id: "step-fb",
    kind: "fillBlank" as const,
    position: 0,
    sentence: null,
    visualContent: null,
    visualKind: null,
    word: null,
    ...overrides,
  };
}

// Wrapper that holds real state, mimicking ActivityPlayerShell.
// The bug triggers when onSelectAnswer dispatches a state update
// to this parent while FillBlankStep's state updater is running.
function ParentWithState({
  children,
}: {
  children: (props: {
    onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
    selectedAnswer: SelectedAnswer | undefined;
  }) => ReactNode;
}) {
  const [answers, setAnswers] = useState<Record<string, SelectedAnswer>>({});

  const handleSelectAnswer = useCallback((stepId: string, answer: SelectedAnswer | null) => {
    if (answer) {
      setAnswers((prev) => ({ ...prev, [stepId]: answer }));
    } else {
      setAnswers((prev) => {
        const { [stepId]: _, ...rest } = prev;
        return rest;
      });
    }
  }, []);

  return (
    <>{children({ onSelectAnswer: handleSelectAnswer, selectedAnswer: answers["step-fb"] })}</>
  );
}

describe("fill in the blank step", () => {
  let consoleErrorSpy: Mock;

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("filling last blank dispatches answer without triggering setState-in-render warning", () => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const step = buildFillBlankStep();

    render(
      <StrictMode>
        <ParentWithState>
          {({ onSelectAnswer, selectedAnswer }) => (
            <FillBlankStep
              onSelectAnswer={onSelectAnswer}
              selectedAnswer={selectedAnswer}
              step={step}
            />
          )}
        </ParentWithState>
      </StrictMode>,
    );

    const wordBank = screen.getByRole("group", { name: /word bank/i });
    const buttons = [...wordBank.querySelectorAll("button")];
    const alphaButton = buttons.find((button) => button.textContent === "alpha");
    const betaButton = buttons.find((button) => button.textContent === "beta");

    fireEvent.click(alphaButton!);
    fireEvent.click(betaButton!);

    const renderWarnings = consoleErrorSpy.mock.calls.filter((args: unknown[]) =>
      String(args[0]).includes("Cannot update a component"),
    );

    expect(renderWarnings).toStrictEqual([]);
  });
});

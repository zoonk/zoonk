// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, StrictMode, useCallback, useState } from "react";
import { type Mock, afterEach, describe, expect, it, vi } from "vitest";
import { type SelectedAnswer } from "../player-reducer";
import { FillBlankStep } from "./fill-blank-step";

vi.mock("next-intl", () => ({
  useExtracted: () => (value: string) => value,
}));

vi.mock("./user-name-context", () => ({
  useReplaceName: () => (value: string) => value,
}));

function buildFillBlankStep(overrides: Record<string, unknown> = {}) {
  return {
    content: {
      answers: ["alpha", "beta"],
      distractors: ["gamma"],
      feedback: "Good",
      template: "Say [BLANK] then [BLANK]",
    },
    fillBlankOptions: [
      { audioUrl: null, romanization: null, translation: null, word: "alpha" },
      { audioUrl: null, romanization: null, translation: null, word: "beta" },
      { audioUrl: null, romanization: null, translation: null, word: "gamma" },
    ],
    id: "step-fb",
    kind: "fillBlank" as const,
    matchColumnsRightItems: [],
    position: 0,
    sentence: null,
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
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
    selectedAnswer?: SelectedAnswer;
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

/**
 * Builds a romanization lookup map from [text, romanization] pairs.
 * Avoids lint warnings for single-character Japanese keys like に, は, を.
 */
function buildRomanizationMap(pairs: [string, string][]): Record<string, string> {
  return Object.fromEntries(pairs);
}

describe("fill in the blank step", () => {
  let consoleErrorSpy: Mock;

  afterEach(() => {
    cleanup();
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

  it("renders romanization on word bank tiles when romanizations map is provided", () => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const step = buildFillBlankStep({
      content: {
        answers: ["を"],
        distractors: ["は", "に"],
        feedback: "Correct",
        romanizations: buildRomanizationMap([
          ["お金をお願いします。", "okane o onegai shimasu."],
          ["に", "ni"],
          ["は", "wa"],
          ["を", "o"],
        ]),
        template: "お金[BLANK]お願いします。",
      },
      fillBlankOptions: [
        { audioUrl: null, romanization: "o", translation: null, word: "を" },
        { audioUrl: null, romanization: "wa", translation: null, word: "は" },
        { audioUrl: null, romanization: "ni", translation: null, word: "に" },
      ],
    });

    render(
      <ParentWithState>
        {({ onSelectAnswer, selectedAnswer }) => (
          <FillBlankStep
            onSelectAnswer={onSelectAnswer}
            selectedAnswer={selectedAnswer}
            step={step}
          />
        )}
      </ParentWithState>,
    );

    expect(screen.getByText("o")).toBeTruthy();
    expect(screen.getByText("wa")).toBeTruthy();
    expect(screen.getByText("ni")).toBeTruthy();
  });

  it("shows template romanization with answer replaced by blank placeholder", () => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const step = buildFillBlankStep({
      content: {
        answers: ["を"],
        distractors: ["は"],
        feedback: "Correct",
        romanizations: buildRomanizationMap([
          ["お金をお願いします。", "okane o onegai shimasu."],
          ["は", "wa"],
          ["を", "o"],
        ]),
        template: "お金[BLANK]お願いします。",
      },
      fillBlankOptions: [
        { audioUrl: null, romanization: "o", translation: null, word: "を" },
        { audioUrl: null, romanization: "wa", translation: null, word: "は" },
      ],
    });

    render(
      <ParentWithState>
        {({ onSelectAnswer, selectedAnswer }) => (
          <FillBlankStep
            onSelectAnswer={onSelectAnswer}
            selectedAnswer={selectedAnswer}
            step={step}
          />
        )}
      </ParentWithState>,
    );

    expect(screen.getByText("okane ____ onegai shimasu.")).toBeTruthy();
  });

  it("handles multi-word answers with spaces in romanization map", () => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const step = buildFillBlankStep({
      content: {
        answers: ["Guten Morgen"],
        distractors: ["Guten Tag"],
        feedback: "Correct",
        romanizations: null,
        template: "[BLANK], wie geht's?",
      },
      fillBlankOptions: [
        { audioUrl: null, romanization: null, translation: null, word: "Guten Morgen" },
        { audioUrl: null, romanization: null, translation: null, word: "Guten Tag" },
      ],
    });

    render(
      <ParentWithState>
        {({ onSelectAnswer, selectedAnswer }) => (
          <FillBlankStep
            onSelectAnswer={onSelectAnswer}
            selectedAnswer={selectedAnswer}
            step={step}
          />
        )}
      </ParentWithState>,
    );

    const wordBank = screen.getByRole("group", { name: /word bank/i });
    const buttons = [...wordBank.querySelectorAll("button")];

    expect(buttons).toHaveLength(2);
    expect(buttons.some((btn) => btn.textContent === "Guten Morgen")).toBeTruthy();
    expect(buttons.some((btn) => btn.textContent === "Guten Tag")).toBeTruthy();
  });
});

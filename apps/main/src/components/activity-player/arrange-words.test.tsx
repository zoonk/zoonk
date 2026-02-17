// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { type Mock, describe, expect, it, vi } from "vitest";
import { ArrangeWordsInteraction } from "./arrange-words";

vi.mock("next-intl", () => ({
  useExtracted: () => (value: string) => value,
}));

vi.mock("@zoonk/utils/shuffle", () => ({
  shuffle: <T,>(array: readonly T[]): T[] => [...array],
}));

vi.mock("./result-announcement", () => ({
  ResultAnnouncement: () => null,
}));

vi.mock("./step-layouts", () => ({
  InteractiveStepLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe(ArrangeWordsInteraction, () => {
  it("does not place more words than the correct answer length", () => {
    const onSelectAnswer: Mock = vi.fn();

    render(
      <ArrangeWordsInteraction
        answerKind="reading"
        correctSentence="Hola mundo"
        correctWords={["Hola", "mundo"]}
        onSelectAnswer={onSelectAnswer}
        selectedAnswer={undefined}
        stepId="step-1"
        wordBankOptions={["Hola", "mundo", "gato"]}
      >
        <p>Prompt</p>
      </ArrangeWordsInteraction>,
    );

    const wordBank = screen.getByRole("group", { name: /word bank/i });
    const answerArea = screen.getByRole("group", { name: /your answer/i });

    // Place two words (correct length)
    fireEvent.click(within(wordBank).getByText("Hola"));
    fireEvent.click(within(wordBank).getByText("mundo"));

    // Answer submitted
    expect(onSelectAnswer).toHaveBeenCalledOnce();

    // Try to place a third word
    fireEvent.click(within(wordBank).getByText("gato"));

    // Answer area should still only have 2 words, not 3
    const placedButtons = within(answerArea).queryAllByRole("button");
    expect(placedButtons).toHaveLength(2);

    // onSelectAnswer should not have been called again
    expect(onSelectAnswer).toHaveBeenCalledOnce();
  });
});

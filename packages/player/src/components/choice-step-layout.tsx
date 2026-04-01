"use client";

import { useExtracted } from "next-intl";
import { useOptionKeyboard } from "../use-option-keyboard";
import { useReplaceName } from "../user-name-context";
import { OptionCard } from "./option-card";
import { ContextText, QuestionText } from "./question-text";
import { InteractiveStepLayout } from "./step-layouts";

/**
 * Shared layout for choice-based steps (multiple choice, story decisions).
 *
 * Owns all rendering and interaction: text display, option list with dimming,
 * keyboard shortcuts (1/2/3), and toggle-to-unselect. Each step kind provides
 * a thin wrapper that parses its content and builds the answer shape.
 */
export function ChoiceStepLayout({
  context,
  keyboardEnabled,
  onSelect,
  options,
  question,
  selectedIndex,
}: {
  context?: string | null;
  keyboardEnabled: boolean;
  onSelect: (index: number) => void;
  options: readonly { key: string; text: string }[];
  question?: string | null;
  selectedIndex: number | null;
}) {
  const t = useExtracted();
  const replaceName = useReplaceName();
  const hasSelection = selectedIndex !== null;

  useOptionKeyboard({
    enabled: keyboardEnabled,
    onSelect,
    optionCount: options.length,
  });

  return (
    <InteractiveStepLayout>
      {(context || question) && (
        <div className="flex flex-col gap-2 sm:gap-6">
          {context && <ContextText>{replaceName(context)}</ContextText>}
          {question && <QuestionText>{replaceName(question)}</QuestionText>}
        </div>
      )}

      <div aria-label={t("Answer options")} className="flex flex-col gap-3" role="radiogroup">
        {options.map((option, index) => (
          <OptionCard
            index={index}
            isDimmed={hasSelection && selectedIndex !== index}
            isSelected={selectedIndex === index}
            key={option.key}
            onSelect={() => onSelect(index)}
          >
            <span className="text-base leading-6">{option.text}</span>
          </OptionCard>
        ))}
      </div>
    </InteractiveStepLayout>
  );
}

import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { ANSWER_TONE } from "@zoonk/learn/answer-tone";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode, useId } from "react";
import { RomanizationText } from "./romanization-text";

function WordBankOptionContent({
  children,
  isInvisible = false,
}: {
  children: ReactNode;
  isInvisible?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 flex-col items-center gap-0.5 text-center",
        isInvisible && "invisible",
      )}
    >
      {children}
    </span>
  );
}

function WordBankOptionDescription({ children, id }: { children: ReactNode; id: string }) {
  return (
    <span className="flex flex-col items-center" id={id}>
      {children}
    </span>
  );
}

function hasWordBankOptionDescription(option: WordBankOption): boolean {
  return Boolean(option.romanization);
}

function getWordBankButtonStateClass({
  disabled,
  isSelected,
}: {
  disabled: boolean;
  isSelected: boolean;
}) {
  if (isSelected) {
    return "bg-muted ring-transparent";
  }

  if (disabled) {
    return "opacity-50";
  }

  return "hover:bg-muted/60";
}

export const WORD_CHIP_CLASS = cn(
  "focus-visible:outline-ring flex min-h-11 min-w-11 flex-col items-center justify-center rounded-lg px-3.5 py-2 text-center text-[0.9375rem] leading-6 font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid",
  ANSWER_TONE.idle,
);

export function WordBankOptionButton({
  disabled,
  isSelected = false,
  onToggle,
  option,
}: {
  disabled: boolean;
  isSelected?: boolean;
  onToggle: () => void;
  option: WordBankOption;
}) {
  const descriptionId = useId();
  const hasDescription = hasWordBankOptionDescription(option);
  const isDisabled = disabled || isSelected;

  return (
    <button
      aria-describedby={hasDescription && !isSelected ? descriptionId : undefined}
      aria-label={option.word}
      className={cn(WORD_CHIP_CLASS, getWordBankButtonStateClass({ disabled, isSelected }))}
      disabled={isDisabled}
      onClick={onToggle}
      type="button"
    >
      <WordBankOptionContent isInvisible={isSelected}>
        <span>{option.word}</span>

        {hasDescription && (
          <WordBankOptionDescription id={descriptionId}>
            <RomanizationText>{option.romanization}</RomanizationText>
          </WordBankOptionDescription>
        )}
      </WordBankOptionContent>
    </button>
  );
}

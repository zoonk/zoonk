import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { ANSWER_TONE } from "@zoonk/learn/answer-tone";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode, useId } from "react";
import { RomanizationText } from "./romanization-text";

/**
 * Word-bank buttons keep their content in one stack so selected placeholders
 * can hide the text while preserving the tile's original width and height.
 */
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

/**
 * Description metadata has its own slot so layout stays coordinated without
 * callers passing styling props into the shared button.
 */
function WordBankOptionDescription({ children, id }: { children: ReactNode; id: string }) {
  return (
    <span className="flex flex-col items-center" id={id}>
      {children}
    </span>
  );
}

/**
 * Parent buttons need to know whether a description id should be wired into
 * aria-describedby, while this component owns the actual visual description.
 */
function hasWordBankOptionDescription(option: WordBankOption): boolean {
  return Boolean(option.romanization);
}

/**
 * Word-bank tiles have three visual states: available, faded once after an
 * answer is checked, and placed words' empty slots that stay only to preserve
 * the bank layout.
 */
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

/**
 * A word chip, in a word bank or placed in an answer: the answer options' strong line and type in
 * a smaller, 10px-round chip.
 */
export const WORD_CHIP_CLASS = cn(
  "focus-visible:outline-ring flex min-h-11 min-w-11 flex-col items-center justify-center rounded-lg px-3.5 py-2 text-center text-[0.9375rem] leading-6 font-medium transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid",
  ANSWER_TONE.idle,
);

/**
 * Shared word-bank button chrome keeps fill-blank, reading, and listening tiles
 * visually identical. The compact centered layout lets short words size to
 * their text plus padding instead of reserving space for unavailable controls.
 */
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

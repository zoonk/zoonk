import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { cn } from "@zoonk/ui/lib/utils";
import { useId } from "react";
import { ResultKbd } from "./result-kbd";
import { RomanizationText } from "./romanization-text";

/**
 * Word-bank buttons add shortcut badges and selection states around the word.
 * Keeping the word, romanization, and pronunciation in one vertical stack
 * prevents those surrounding controls from flattening pronunciation hints into
 * the main text row.
 */
function WordBankOptionContent({
  descriptionId,
  option,
}: {
  descriptionId?: string;
  option: WordBankOption;
}) {
  const hasDescription = hasWordBankOptionDescription(option);

  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
      <span>{option.word}</span>

      {hasDescription && (
        <span className="flex flex-col items-start" id={descriptionId}>
          <RomanizationText>{option.romanization}</RomanizationText>

          {option.pronunciation && (
            <span className="text-muted-foreground text-xs">{option.pronunciation}</span>
          )}
        </span>
      )}
    </span>
  );
}

/**
 * Parent buttons need to know whether a description id should be wired into
 * aria-describedby, while this component owns the actual visual description.
 */
function hasWordBankOptionDescription(option: WordBankOption): boolean {
  return Boolean(option.romanization || option.pronunciation);
}

/**
 * Shared word-bank button chrome keeps fill-blank, reading, and listening tiles
 * visually identical. The shortcut badge sits next to the text stack so
 * pronunciation and romanization stay below the word instead of beside it.
 */
export function WordBankOptionButton({
  disabled,
  isUsed,
  onToggle,
  option,
  shortcut,
}: {
  disabled: boolean;
  isUsed: boolean;
  onToggle: () => void;
  option: WordBankOption;
  shortcut: string | null;
}) {
  const descriptionId = useId();
  const hasDescription = hasWordBankOptionDescription(option);

  return (
    <button
      aria-describedby={hasDescription ? descriptionId : undefined}
      aria-label={option.word}
      aria-keyshortcuts={shortcut ?? undefined}
      aria-pressed={isUsed}
      className={cn(
        "border-border flex min-h-11 min-w-16 items-center justify-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-all duration-150",
        disabled
          ? "opacity-50"
          : "hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        isUsed && !disabled && "opacity-70",
      )}
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      {shortcut && (
        <ResultKbd className="hidden lg:pointer-fine:inline-flex" isSelected={isUsed}>
          {shortcut}
        </ResultKbd>
      )}

      <WordBankOptionContent descriptionId={descriptionId} option={option} />
    </button>
  );
}

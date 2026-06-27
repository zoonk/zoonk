import { type WordBankOption } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode, useId } from "react";
import { RomanizationText } from "./romanization-text";

/**
 * Word-bank buttons keep the word, romanization, and pronunciation in one
 * vertical stack so metadata reads as a hint for the word instead of a separate
 * option.
 */
function WordBankOptionContent({ children }: { children: ReactNode }) {
  return <span className="flex min-w-0 flex-col items-center gap-0.5 text-center">{children}</span>;
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
  return Boolean(option.romanization || option.pronunciation);
}

/**
 * Shared word-bank button chrome keeps fill-blank, reading, and listening tiles
 * visually identical. The compact centered layout lets short words size to
 * their text plus padding instead of reserving space for unavailable controls.
 */
export function WordBankOptionButton({
  disabled,
  onToggle,
  option,
}: {
  disabled: boolean;
  onToggle: () => void;
  option: WordBankOption;
}) {
  const descriptionId = useId();
  const hasDescription = hasWordBankOptionDescription(option);

  return (
    <button
      aria-describedby={hasDescription ? descriptionId : undefined}
      aria-label={option.word}
      className={cn(
        "border-border flex min-h-11 flex-col items-center justify-center rounded-lg border px-4 py-2.5 text-center transition-all duration-150 outline-none",
        disabled
          ? "opacity-50"
          : "hover:bg-accent focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
      )}
      disabled={disabled}
      onClick={onToggle}
      type="button"
    >
      <WordBankOptionContent>
        <span>{option.word}</span>

        {hasDescription && (
          <WordBankOptionDescription id={descriptionId}>
            <RomanizationText>{option.romanization}</RomanizationText>

            {option.pronunciation && (
              <span className="text-muted-foreground text-xs">{option.pronunciation}</span>
            )}
          </WordBankOptionDescription>
        )}
      </WordBankOptionContent>
    </button>
  );
}

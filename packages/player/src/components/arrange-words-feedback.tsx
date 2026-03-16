import { useExtracted } from "next-intl";
import { type WordBankOption } from "../prepare-activity-data";

function emptyWordOption(word: string): WordBankOption {
  return { audioUrl: null, romanization: null, translation: null, word };
}

function getCorrectWordOptions(
  correctWords: string[],
  wordBankOptions: WordBankOption[],
): WordBankOption[] {
  const remaining = [...wordBankOptions];

  return correctWords.map((word) => {
    const index = remaining.findIndex((option) => option.word === word);

    if (index === -1) {
      return emptyWordOption(word);
    }

    return remaining.splice(index, 1)[0] ?? emptyWordOption(word);
  });
}

function FeedbackWordCard({ option }: { option: WordBankOption }) {
  return (
    <span className="bg-muted/50 flex flex-col items-center rounded-md px-3 py-1.5">
      <span className="text-sm font-medium">{option.word}</span>

      {option.romanization && (
        <span className="text-muted-foreground text-[11px]">{option.romanization}</span>
      )}

      {option.translation && (
        <span className="text-muted-foreground text-xs">{option.translation}</span>
      )}
    </span>
  );
}

export function ArrangeWordsFeedback({
  correctWords,
  translation,
  wordBankOptions,
}: {
  correctWords: string[];
  translation: string;
  wordBankOptions: WordBankOption[];
}) {
  const t = useExtracted();

  return (
    <div className="border-border/40 flex flex-col gap-3 border-t pt-3">
      <div aria-label={t("Correct answer")} className="flex flex-wrap gap-2" role="group">
        {getCorrectWordOptions(correctWords, wordBankOptions).map((option, index) => (
          <FeedbackWordCard
            // oxlint-disable-next-line react/no-array-index-key -- Words can repeat, no unique ID
            key={`feedback-${option.word}-${index}`}
            option={option}
          />
        ))}
      </div>

      <p className="text-muted-foreground text-sm">{translation}</p>
    </div>
  );
}

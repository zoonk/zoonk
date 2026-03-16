import { useExtracted } from "next-intl";
import { type WordBankOption } from "../prepare-activity-data";
import { RomanizationText } from "./romanization-text";

function FeedbackWordCard({ option }: { option: WordBankOption }) {
  return (
    <span className="bg-muted/50 flex flex-col items-center rounded-md px-3 py-1.5">
      <span className="text-sm font-medium">{option.word}</span>

      <RomanizationText>{option.romanization}</RomanizationText>

      {option.translation && (
        <span className="text-muted-foreground text-xs">{option.translation}</span>
      )}
    </span>
  );
}

function getCorrectWordOptions(
  correctWords: string[],
  wordBankOptions: WordBankOption[],
): WordBankOption[] {
  const remaining = [...wordBankOptions];

  return correctWords.map((word) => {
    const index = remaining.findIndex((option) => option.word === word);

    if (index === -1) {
      return { audioUrl: null, romanization: null, translation: null, word };
    }

    return (
      remaining.splice(index, 1)[0] ?? {
        audioUrl: null,
        romanization: null,
        translation: null,
        word,
      }
    );
  });
}

type ReadingFeedbackProps = {
  kind: "reading";
  correctWords: string[];
  wordBankOptions: WordBankOption[];
};

type ListeningFeedbackProps = {
  kind: "listening";
  sentenceWordOptions: WordBankOption[];
  translation: string;
};

export type ArrangeWordsFeedbackProps = ReadingFeedbackProps | ListeningFeedbackProps;

function WordCards({ options }: { options: WordBankOption[] }) {
  const t = useExtracted();

  return (
    <div aria-label={t("Correct answer")} className="flex flex-wrap gap-2" role="group">
      {options.map((option, index) => (
        <FeedbackWordCard
          // oxlint-disable-next-line react/no-array-index-key -- Words can repeat, no unique ID
          key={`feedback-${option.word}-${index}`}
          option={option}
        />
      ))}
    </div>
  );
}

export function ArrangeWordsFeedback(props: ArrangeWordsFeedbackProps) {
  if (props.kind === "reading") {
    return (
      <div className="border-border/40 flex flex-col gap-3 border-t pt-3">
        <WordCards options={getCorrectWordOptions(props.correctWords, props.wordBankOptions)} />
      </div>
    );
  }

  return (
    <div className="border-border/40 flex flex-col gap-3 border-t pt-3">
      <WordCards options={props.sentenceWordOptions} />
      <RomanizationText>{props.translation}</RomanizationText>
    </div>
  );
}

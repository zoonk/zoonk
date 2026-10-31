"use client";

import {
  type SerializedStep,
  type WordBankOption,
} from "@zoonk/core/player/contracts/prepare-lesson-data";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Fragment } from "react";
import { type SelectedAnswer, type StepResult } from "../step-answer";
import {
  type ReadingPromptWordHint,
  buildReadingPromptWordHints,
} from "./_utils/reading-prompt-word-hints";
import { stripWrappingQuotes } from "./_utils/strip-wrapping-quotes";
import { ArrangeWordsInteraction } from "./arrange-words";
import { QuestionText } from "./question-text";
import { ScreenChip } from "./screen-chip";

function ReadingPromptWord({
  hint,
  standalone,
}: {
  hint: ReadingPromptWordHint;
  standalone: boolean;
}) {
  if (!hint.translation) {
    return <span>{hint.word}</span>;
  }

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "focus-visible:border-ring focus-visible:ring-ring/50 decoration-foreground/30 hover:text-foreground rounded-sm border-0 bg-transparent p-0 font-[inherit] text-inherit underline decoration-dotted underline-offset-4 transition-colors outline-none focus-visible:ring-[3px]",
          standalone ? "inline-flex min-h-11 min-w-11 items-center" : "inline",
        )}
      >
        {hint.word}
      </PopoverTrigger>

      <PopoverContent
        className="w-fit max-w-none min-w-0 gap-0 rounded-xl px-3 py-2"
        sideOffset={8}
      >
        <PopoverHeader className="gap-0.5">
          <PopoverTitle className="text-base">{hint.translation}</PopoverTitle>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  );
}

function ReadingPromptText({
  sentence,
  sentenceWordOptions,
}: {
  sentence: string;
  sentenceWordOptions: WordBankOption[];
}) {
  const prompt = stripWrappingQuotes(sentence);
  const hints = buildReadingPromptWordHints({ prompt, sentenceWordOptions });
  const hasWordSpaces = prompt.includes(" ");

  return (
    <span>
      {hints.map((hint, index) => (
        // oxlint-disable-next-line react/no-array-index-key -- Prompt words can repeat in generated sentences, no unique ID.
        <Fragment key={`${hint.word}-${hint.translation ?? "none"}-${index}`}>
          {index > 0 && hasWordSpaces ? " " : null}
          <ReadingPromptWord hint={hint} standalone={hints.length === 1} />
        </Fragment>
      ))}
    </span>
  );
}

export function ReadingStep({
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer?: SelectedAnswer;
  step: SerializedStep;
}) {
  const t = useExtracted();

  if (!step.sentence) {
    return null;
  }

  return (
    <ArrangeWordsInteraction
      answer={step.sentence.sentence}
      answerKind="reading"
      onSelectAnswer={onSelectAnswer}
      result={result}
      selectedAnswer={selectedAnswer}
      wordBankOptions={step.wordBankOptions}
    >
      <div className="flex flex-col gap-2">
        <ScreenChip>{t("Translate")}</ScreenChip>
        <QuestionText>
          <ReadingPromptText
            sentence={step.sentence.translation}
            sentenceWordOptions={step.sentenceWordOptions}
          />
        </QuestionText>
      </div>
    </ArrangeWordsInteraction>
  );
}

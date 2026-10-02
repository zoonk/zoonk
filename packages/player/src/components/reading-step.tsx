"use client";

import {
  buildAcceptedArrangeWordSequences,
  getAcceptedArrangeWordLengths,
} from "@zoonk/core/player/contracts/arrange-words-answers";
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
import { useReplaceName } from "../user-name-context";
import {
  type ReadingPromptWordHint,
  buildReadingPromptWordHints,
} from "./_utils/reading-prompt-word-hints";
import { stripWrappingQuotes } from "./_utils/strip-wrapping-quotes";
import { ArrangeWordsInteraction } from "./arrange-words";
import { QuestionText } from "./question-text";
import { SectionLabel } from "./section-label";

/**
 * One prompt word can either be plain text or a small translation trigger.
 *
 * Reading learners tap the sentence they are translating, not the answer bank,
 * so the interactive affordance belongs on these prompt words. Inside a sentence a
 * word keeps the line's height, like a link in prose; a word shown on its own is a
 * 44 px target.
 */
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

/**
 * Renders the visible reading prompt as tappable word tokens.
 *
 * The serialized lesson stores target-word metadata, while the prompt sentence
 * is learner-language text. `buildReadingPromptWordHints` aligns those two
 * shapes so this component can stay focused on rendering.
 */
function ReadingPromptText({
  sentence,
  sentenceWordOptions,
}: {
  sentence: string;
  sentenceWordOptions: WordBankOption[];
}) {
  const replaceName = useReplaceName();
  const prompt = stripWrappingQuotes(replaceName(sentence));
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

  const acceptedWordSequences = buildAcceptedArrangeWordSequences(step.sentence.sentence, []);
  const correctWords = acceptedWordSequences[0] ?? [];
  const acceptedWordLengths = getAcceptedArrangeWordLengths(acceptedWordSequences);

  return (
    <ArrangeWordsInteraction
      acceptedWordLengths={acceptedWordLengths}
      answerKind="reading"
      correctWords={correctWords}
      onSelectAnswer={onSelectAnswer}
      result={result}
      selectedAnswer={selectedAnswer}
      wordBankOptions={step.wordBankOptions}
    >
      <div className="flex flex-col gap-2">
        <SectionLabel>{t("Translate this sentence:")}</SectionLabel>
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

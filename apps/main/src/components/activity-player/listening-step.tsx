"use client";

import { type SerializedStep } from "@/data/activities/prepare-activity-data";
import { cn } from "@zoonk/ui/lib/utils";
import { PauseIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ArrangeWordsInteraction } from "./arrange-words";
import { type SelectedAnswer, type StepResult } from "./player-reducer";
import { QuestionText } from "./question-text";
import { SectionLabel } from "./section-label";
import { useWordAudio } from "./use-word-audio";

function AudioPrompt({ audioUrl }: { audioUrl: string }) {
  const t = useExtracted();
  const [isPlaying, setIsPlaying] = useState(false);
  const { play } = useWordAudio({ onEnded: () => setIsPlaying(false) });

  const handleClick = () => {
    setIsPlaying(true);
    play(audioUrl);
  };

  const Icon = isPlaying ? PauseIcon : Volume2Icon;
  const label = isPlaying ? t("Pause audio") : t("Play audio");

  return (
    <div className="flex flex-col items-center gap-3">
      <SectionLabel>{t("What do you hear?")}</SectionLabel>

      <button
        aria-label={label}
        className={cn(
          "bg-primary text-primary-foreground flex size-14 items-center justify-center rounded-full transition-all duration-150",
          "hover:bg-primary/90 focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        )}
        onClick={handleClick}
        type="button"
      >
        <Icon className="size-6" />
      </button>
    </div>
  );
}

function TextPrompt({ sentence }: { sentence: string }) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-2">
      <SectionLabel>{t("Translate this sentence:")}</SectionLabel>
      <QuestionText>{sentence}</QuestionText>
    </div>
  );
}

export function ListeningStep({
  onSelectAnswer,
  result,
  selectedAnswer,
  step,
}: {
  onSelectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  result?: StepResult;
  selectedAnswer: SelectedAnswer | undefined;
  step: SerializedStep;
}) {
  if (!step.sentence) {
    return null;
  }

  return (
    <ArrangeWordsInteraction
      answerKind="listening"
      correctSentence={step.sentence.translation}
      correctWords={step.sentence.translation.split(" ")}
      onSelectAnswer={onSelectAnswer}
      result={result}
      selectedAnswer={selectedAnswer}
      stepId={step.id}
      wordBankOptions={step.wordBankOptions}
    >
      {step.sentence.audioUrl ? (
        <AudioPrompt audioUrl={step.sentence.audioUrl} />
      ) : (
        <TextPrompt sentence={step.sentence.sentence} />
      )}
    </ArrangeWordsInteraction>
  );
}

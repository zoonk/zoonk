"use client";

import { useExtracted } from "next-intl";
import { type SerializedStep } from "../prepare-activity-data";
import { PlayAudioButton } from "./play-audio-button";
import { ContextText } from "./question-text";
import { useSwipeNavigation } from "./static-step-navigation";

export function VocabularyStep({
  canNavigatePrev,
  onNavigateNext,
  onNavigatePrev,
  step,
}: {
  canNavigatePrev: boolean;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const word = step.word;
  const swipeHandlers = useSwipeNavigation({ canNavigatePrev, onNavigateNext, onNavigatePrev });

  if (!word) {
    return null;
  }

  return (
    <div
      aria-label={`${t("Vocabulary")}: ${word.word}`}
      className="flex w-full max-w-2xl flex-1 flex-col items-start justify-center px-10 sm:px-16"
      role="region"
      {...swipeHandlers}
    >
      <div className="flex flex-col gap-6">
        {word.audioUrl && <PlayAudioButton audioUrl={word.audioUrl} size="sm" />}

        <div className="flex flex-col gap-2">
          <p className="text-4xl font-bold tracking-tight sm:text-5xl">{word.word}</p>

          {word.romanization && (
            <p className="text-muted-foreground text-sm italic">{word.romanization}</p>
          )}

          {word.pronunciation && (
            <p className="text-muted-foreground text-sm">{word.pronunciation}</p>
          )}
        </div>

        <ContextText>{word.translation}</ContextText>
      </div>
    </div>
  );
}

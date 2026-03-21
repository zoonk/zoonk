"use client";

import { useExtracted } from "next-intl";
import { type SerializedStep } from "../prepare-activity-data";
import { PlayAudioButton } from "./play-audio-button";
import { ContextText } from "./question-text";
import { RomanizationText } from "./romanization-text";

export function VocabularyStep({ step }: { step: SerializedStep }) {
  const t = useExtracted();
  const word = step.word;

  if (!word) {
    return null;
  }

  return (
    <div
      aria-label={`${t("Vocabulary")}: ${word.word}`}
      className="flex w-full max-w-2xl flex-1 flex-col items-start justify-center px-8 sm:px-10"
      role="region"
    >
      <div className="flex flex-col gap-6">
        {word.audioUrl && <PlayAudioButton audioUrl={word.audioUrl} size="sm" />}

        <div className="flex flex-col gap-2">
          <p className="text-4xl font-bold tracking-tight sm:text-5xl">{word.word}</p>

          <RomanizationText>{word.romanization}</RomanizationText>

          {word.pronunciation && (
            <p className="text-muted-foreground text-sm">{word.pronunciation}</p>
          )}
        </div>

        <ContextText>{word.translation}</ContextText>
      </div>
    </div>
  );
}

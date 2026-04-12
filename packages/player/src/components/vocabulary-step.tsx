"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { useExtracted } from "next-intl";
import { PlayAudioButton } from "./play-audio-button";
import { PlayerReadScene, PlayerReadSceneBody, PlayerReadSceneStack } from "./player-read-scene";
import { RomanizationText } from "./romanization-text";

export function VocabularyStep({ step }: { step: SerializedStep }) {
  const t = useExtracted();
  const word = step.word;

  if (!word) {
    return null;
  }

  return (
    <PlayerReadScene>
      <div
        aria-label={`${t("Vocabulary")}: ${word.word}`}
        role="region"
        className="flex flex-col gap-6"
      >
        {word.audioUrl && <PlayAudioButton audioUrl={word.audioUrl} size="sm" />}

        <PlayerReadSceneStack className="gap-2">
          <p className="text-4xl font-bold tracking-tight sm:text-5xl">{word.word}</p>

          <RomanizationText>{word.romanization}</RomanizationText>

          {word.pronunciation && (
            <p className="text-muted-foreground text-sm">{word.pronunciation}</p>
          )}
        </PlayerReadSceneStack>

        <PlayerReadSceneBody>{word.translation}</PlayerReadSceneBody>
      </div>
    </PlayerReadScene>
  );
}

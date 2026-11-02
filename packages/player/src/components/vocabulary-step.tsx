"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { useExtracted } from "next-intl";
import { usePromptAudio } from "../player-audio-context";
import { PlayerReadScene, PlayerReadSceneBody, PlayerReadSceneStack } from "./player-read-scene";
import { PromptAudioButton } from "./prompt-audio-button";
import { RomanizationText } from "./romanization-text";

export function VocabularyStep({
  children,
  step,
}: {
  children?: React.ReactNode;
  step: SerializedStep;
}) {
  const t = useExtracted();
  const audio = usePromptAudio();
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
        <PlayerReadSceneStack className="gap-2">
          <p className="text-title lg:text-[2.5rem]">
            {word.word}
            {audio && (
              <span className="ms-2 inline-flex h-lh items-center align-top">
                <PromptAudioButton audio={audio} variant="inline" />
              </span>
            )}
          </p>

          <RomanizationText>{word.romanization}</RomanizationText>

          {word.pronunciation && (
            <p className="text-muted-foreground text-sm">{word.pronunciation}</p>
          )}
        </PlayerReadSceneStack>

        <PlayerReadSceneBody>{word.translation}</PlayerReadSceneBody>
        {children}
      </div>
    </PlayerReadScene>
  );
}

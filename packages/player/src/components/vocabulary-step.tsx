"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { PauseIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { type SerializedStep } from "../prepare-activity-data";
import { useWordAudio } from "../use-word-audio";
import { SectionLabel } from "./section-label";
import { InteractiveStepLayout } from "./step-layouts";

const AUTO_PLAY_DELAY = 300;

function AudioButton({ audioUrl }: { audioUrl: string }) {
  const t = useExtracted();
  const [isPlaying, setIsPlaying] = useState(false);
  const { pause, play } = useWordAudio({ onEnded: () => setIsPlaying(false) });

  const handleClick = () => {
    if (isPlaying) {
      pause();
      setIsPlaying(false);
    } else {
      play(audioUrl);
      setIsPlaying(true);
    }
  };

  const Icon = isPlaying ? PauseIcon : Volume2Icon;
  const label = isPlaying ? t("Pause pronunciation") : t("Play pronunciation");

  return (
    <button
      aria-label={label}
      className={cn(
        "bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-full transition-all duration-150",
        "hover:bg-primary/90 focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
      )}
      onClick={handleClick}
      type="button"
    >
      <Icon className="size-5" />
    </button>
  );
}

export function VocabularyStep({ step }: { step: SerializedStep }) {
  const t = useExtracted();
  const word = step.word;
  const hasAutoPlayed = useRef(false);
  const { play } = useWordAudio();

  useEffect(() => {
    if (!word?.audioUrl || hasAutoPlayed.current) {
      return;
    }

    hasAutoPlayed.current = true;

    const timer = setTimeout(() => {
      play(word.audioUrl);
    }, AUTO_PLAY_DELAY);

    return () => clearTimeout(timer);
  }, [word?.audioUrl, play]);

  if (!word) {
    return null;
  }

  return (
    <InteractiveStepLayout>
      <div
        aria-label={`${t("Vocabulary")}: ${word.word}`}
        className="flex flex-col items-center gap-6 py-8 text-center sm:py-12"
        role="region"
      >
        <div className="flex flex-col items-center gap-3">
          <p className="text-3xl font-semibold sm:text-4xl">{word.word}</p>

          {word.romanization && (
            <p className="text-muted-foreground text-sm italic">{word.romanization}</p>
          )}

          {word.audioUrl && <AudioButton audioUrl={word.audioUrl} />}
        </div>

        <hr className="border-border/50 w-16" />

        <div className="flex flex-col items-center gap-2">
          <SectionLabel>{t("Translation")}</SectionLabel>
          <p className="text-muted-foreground text-lg sm:text-xl">{word.translation}</p>
        </div>
      </div>
    </InteractiveStepLayout>
  );
}

"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { SnailIcon, Volume2Icon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { LessonRichText } from "../_components/lesson-rich-text";
import { type SpokenAnswerHeard } from "../lesson-player-types";
import { usePracticeWordAudio } from "./use-practice-word-audio";

type HeardWord = SpokenAnswerHeard["words"][number];
type PracticeWord = SpokenAnswerHeard["wordsToPractice"][number];

const WORD_TONE = {
  correct: "text-success",
  different: "text-destructive underline decoration-wavy underline-offset-4",
  missed: "text-muted-foreground line-through",
} as const;

function HeardWordLabel({ word }: { word: HeardWord }) {
  const t = useExtracted();

  return (
    <>
      {word.text}
      {word.status !== "correct" && (
        <span className="sr-only">
          {word.status === "missed"
            ? t("(not heard)")
            : t("(heard as {heard})", { heard: word.heard ?? "" })}
        </span>
      )}
    </>
  );
}

/** A word to practice is a button: tapping it opens its sounds and plays it, then slowly. */
function PracticeWordButton({
  isSelected,
  onSelect,
  panelId,
  word,
}: {
  isSelected: boolean;
  onSelect: () => void;
  panelId: string;
  word: HeardWord;
}) {
  return (
    <button
      aria-controls={panelId}
      aria-pressed={isSelected}
      className={cn(
        "focus-visible:ring-ring/50 me-1.5 inline-block rounded-md px-1 outline-none focus-visible:ring-[3px]",
        "bg-destructive/10 hover:bg-destructive/15",
        isSelected && "ring-destructive/40 ring-2",
        WORD_TONE[word.status],
      )}
      onClick={onSelect}
      type="button"
    >
      <HeardWordLabel word={word} />
    </button>
  );
}

/** The chosen word's native and slow sounds, its respelling and its one tip. */
function PracticePanel({
  id,
  onPlay,
  word,
}: {
  id: string;
  onPlay: (slow: boolean) => void;
  word: PracticeWord;
}) {
  const t = useExtracted();

  return (
    <div
      aria-label={t("How to say {word}", { word: word.text })}
      className="bg-background flex flex-col gap-2 rounded-xl p-3"
      id={id}
      role="region"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-baseline gap-2">
          <span className="font-semibold">{word.text}</span>
          {word.respelling && (
            <span className="text-muted-foreground text-sm">
              {t("sounds like {respelling}", { respelling: word.respelling })}
            </span>
          )}
        </p>
        <span className="flex gap-1.5">
          <Button onClick={() => onPlay(false)} size="sm" variant="outline">
            <Volume2Icon aria-hidden="true" />
            {t("Listen")}
          </Button>
          <Button onClick={() => onPlay(true)} size="sm" variant="outline">
            <SnailIcon aria-hidden="true" />
            {t("Slowly")}
          </Button>
        </span>
      </div>
      {word.tip && (
        <p className="text-sm leading-relaxed">
          <LessonRichText text={word.tip} />
        </p>
      )}
    </div>
  );
}

function findPracticeIndex(practice: readonly PracticeWord[], word: HeardWord): number {
  return practice.findIndex((item) => item.text === word.text);
}

/**
 * What was heard, word by word: right, said differently or missed. At most two words to practice
 * stand out as buttons; tapping one plays its native audio and then a slow version, with the
 * respelling for the learner's language and its one sound tip.
 */
export function LessonSpokenWords({
  heard,
  language,
}: {
  heard: SpokenAnswerHeard;
  /** The language spoken, to read a word aloud when it has no recording. */
  language: string;
}) {
  const t = useExtracted();
  const panelId = useId();
  const practice = heard.wordsToPractice;
  const [selected, setSelected] = useState(0);
  const word = practice[selected];

  const audio = usePracticeWordAudio({
    audioUrls: practice.map((item) => item.audioUrl),
    language,
  });

  const select = (index: number) => {
    const next = practice[index];
    setSelected(index);

    if (next) {
      audio.playBoth(next);
    }
  };

  return (
    <div className="flex flex-col gap-2" data-slot="lesson-spoken-words">
      <p className="text-muted-foreground text-sm font-medium">{t("What we heard")}</p>
      <p className="text-lg leading-relaxed">
        {heard.words.map((item, index) => {
          const key = `${item.text}-${index}`;
          const practiceIndex = findPracticeIndex(practice, item);

          return practiceIndex === -1 ? (
            <span className={cn("me-1.5 inline-block", WORD_TONE[item.status])} key={key}>
              <HeardWordLabel word={item} />
            </span>
          ) : (
            <PracticeWordButton
              isSelected={practiceIndex === selected}
              key={key}
              onSelect={() => select(practiceIndex)}
              panelId={panelId}
              word={item}
            />
          );
        })}
      </p>
      {word && (
        <PracticePanel id={panelId} onPlay={(slow) => audio.play(word, { slow })} word={word} />
      )}
    </div>
  );
}

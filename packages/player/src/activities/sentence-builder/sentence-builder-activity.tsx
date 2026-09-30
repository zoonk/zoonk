"use client";

import { sentenceEdges } from "@zoonk/core/library/activities/language";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { LessonRichText } from "../../lesson/_components/lesson-rich-text";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { ActivitySpeakButton } from "../_components/activity-speak-button";
import { expectedInteraction } from "../_utils/activity-expected";
import { useSpeech } from "../_utils/use-speech";
import { type ActivityRendererProps } from "../activity-renderer";
import {
  type BankTile,
  bankTiles,
  builtSentence,
  correctionWords,
  isAcceptedSentence,
} from "./sentence-bank";
import { WordTile, type WordTileState } from "./word-tile";

type SentenceBuilderProps = ActivityRendererProps<"sentenceBuilder">;

function acceptedSentences(props: SentenceBuilderProps): string[] {
  const { content, expected } = props;

  return (
    expectedInteraction(expected, "text")?.accepted ?? [
      content.fields.target,
      ...content.fields.acceptedVariants,
    ]
  );
}

/** Rebuilds which tiles a saved answer used, word by word, taking each tile once. */
function placedFromAnswer(tiles: readonly BankTile[], text: string | null): string[] {
  const words = text ? text.split(/\s+/u).filter(Boolean) : [];

  return words.flatMap((word, index) => {
    const occurrence = words.slice(0, index).filter((earlier) => earlier === word).length;
    const tile = tiles.filter((item) => item.text === word)[occurrence];
    return tile ? [tile.id] : [];
  });
}

function placedState({
  isAccepted,
  isChecked,
  tile,
}: {
  isAccepted: boolean;
  isChecked: boolean;
  tile: BankTile | undefined;
}): WordTileState {
  if (!isChecked) {
    return "idle";
  }

  if (isAccepted) {
    return "correct";
  }

  return tile?.why ? "wrong" : "idle";
}

/** The right sentence to hear and the reason each wrong word doesn't fit. */
function SentenceAnswer({
  built,
  canSpeak,
  onSpeak,
  target,
  usedDistractors,
}: {
  built: string;
  canSpeak: boolean;
  onSpeak: () => void;
  target: string;
  usedDistractors: readonly BankTile[];
}) {
  const t = useExtracted();

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-background flex items-center gap-3 rounded-2xl py-1.5 pr-1.5 pl-4">
        <p className="flex-1 text-lg font-semibold">
          <span className="sr-only">{`${t("Correct answer:")} `}</span>
          {correctionWords(target, built).map(({ isNew, word }, index, words) => (
            <span className={cn(isNew && "text-success")} key={`${String(index)}-${word}`}>
              {index < words.length - 1 ? `${word} ` : word}
            </span>
          ))}
        </p>
        {canSpeak && <ActivitySpeakButton label={t("Hear the sentence")} onSpeak={onSpeak} />}
      </div>

      {usedDistractors.map((tile) => (
        <p className="text-sm leading-relaxed" key={tile.id}>
          <span className="text-destructive me-1 font-semibold">{`${tile.text}:`}</span>
          <LessonRichText text={tile.why ?? ""} />
        </p>
      ))}
    </div>
  );
}

/**
 * Build a sentence in the target language from word tiles, with distractors that test one
 * choice. Tap a tile to add it, tap it in the sentence to take it back; the answer is the words
 * in order, graded without punctuation or case. After the check, the right sentence can be
 * heard and each wrong word explains itself.
 */
export function SentenceBuilderActivity(props: SentenceBuilderProps) {
  const t = useExtracted();
  const { answer, content, labelId, onAnswerChange, phase } = props;
  const { fields } = content;
  const tiles = bankTiles(fields);
  const speech = useSpeech(fields.language);
  const edges = sentenceEdges(fields.target);

  const [placed, setPlaced] = useState(() =>
    placedFromAnswer(tiles, answer?.kind === "text" ? answer.text : null),
  );

  const isChecked = phase === "checked";
  const sentence = builtSentence(tiles, placed);
  const isAccepted = isAcceptedSentence(sentence, acceptedSentences(props));
  const usedDistractors = tiles.filter((tile) => tile.why && placed.includes(tile.id));

  function update(next: string[]) {
    setPlaced(next);
    const text = builtSentence(tiles, next);
    onAnswerChange(text ? { kind: "text", text } : null);
  }

  return (
    <ActivityCanvas className="gap-5" labelId={labelId}>
      <div className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">{fields.situation}</p>
        <p className="text-lg leading-snug font-semibold">{fields.prompt}</p>
      </div>

      <div className="flex items-start gap-2">
        <div
          aria-label={t("Your sentence")}
          className="border-border flex min-h-26 flex-1 flex-wrap content-start items-center gap-x-2 gap-y-3 border-b pb-3"
          role="group"
        >
          {edges.start && (
            <span aria-hidden="true" className="text-xl font-medium">
              {edges.start}
            </span>
          )}

          {placed.map((id) => {
            const tile = tiles.find((item) => item.id === id);

            return (
              <WordTile
                disabled={isChecked}
                key={id}
                label={t("Remove {word}", { word: tile?.text ?? "" })}
                onClick={() => update(placed.filter((item) => item !== id))}
                state={placedState({ isAccepted, isChecked, tile })}
              >
                {tile?.text ?? ""}
              </WordTile>
            );
          })}

          {edges.end && placed.length > 0 && (
            <span aria-hidden="true" className="text-xl font-medium">
              {edges.end}
            </span>
          )}
        </div>

        {speech.status === "ready" && placed.length > 0 && (
          <ActivitySpeakButton
            label={t("Hear your sentence")}
            onSpeak={() => speech.speak({ segments: [sentence] })}
          />
        )}
      </div>

      {!isChecked && (
        <div
          aria-label={t("Word tiles")}
          className="flex flex-wrap justify-center gap-2"
          role="group"
        >
          {tiles.map((tile) => (
            <WordTile
              key={tile.id}
              onClick={() => update([...placed, tile.id])}
              state={placed.includes(tile.id) ? "placeholder" : "idle"}
            >
              {tile.text}
            </WordTile>
          ))}
        </div>
      )}

      {isChecked && !isAccepted && (
        <SentenceAnswer
          built={sentence}
          canSpeak={speech.status === "ready"}
          onSpeak={() => speech.speak({ segments: [fields.target] })}
          target={fields.target}
          usedDistractors={usedDistractors}
        />
      )}

      <p aria-live="polite" className="sr-only">
        {sentence ? t("Your sentence: {sentence}", { sentence }) : t("Your sentence is empty")}
      </p>

      <ActivityTextAlternative>
        {t("Build the sentence from the word tiles. Some tiles don't belong.")}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}

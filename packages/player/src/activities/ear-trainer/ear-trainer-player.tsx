"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRight, Play } from "lucide-react";
import { useExtracted } from "next-intl";
import { Fragment } from "react";
import { keepArrowKeys } from "../_utils/keep-arrow-keys";
import { chordSymbol } from "../_utils/music-notes";
import { type ActivityRendererProps } from "../activity-renderer";

type EarTrainerFields = ActivityRendererProps<"earTrainer">["content"]["fields"];
type ProgressionFields = Extract<EarTrainerFields, { mode: "progression" }>;

/** What the learner is about to hear, so they know what to listen for. */
function useListenHint(fields: EarTrainerFields): string {
  const t = useExtracted();

  if (fields.mode === "interval") {
    return t("Two notes, low then high");
  }

  if (fields.mode === "chord") {
    return t("One chord, then its notes one by one");
  }

  return t("{count} chords, one after another", { count: String(fields.chords.length) });
}

/** The progression as chord cards, the hidden one a question mark until the check. */
function ProgressionStrip({
  fields,
  isChecked,
  playingIndex,
}: {
  fields: ProgressionFields;
  isChecked: boolean;
  playingIndex: number | null;
}) {
  const t = useExtracted();

  return (
    <ol aria-label={t("The chords you hear")} className="flex items-center justify-center gap-1.5">
      {fields.chords.map((chord, index) => {
        const isHidden = index === fields.hidden;
        const label = isHidden && !isChecked ? "?" : chordSymbol(chord.root, chord.quality);

        return (
          <Fragment key={`${chord.root}-${chord.quality}-${String(index)}`}>
            {index > 0 && (
              <ArrowRight aria-hidden="true" className="text-muted-foreground size-4" />
            )}

            <li
              aria-current={playingIndex === index ? "true" : undefined}
              aria-label={isHidden && !isChecked ? t("The chord to name") : label}
              className={cn(
                "flex h-14 min-w-14 items-center justify-center rounded-2xl px-3 text-xl font-bold motion-safe:transition-all",
                isHidden
                  ? "border-viz-accent text-viz-accent border-2 border-dashed"
                  : "bg-background border-border border",
                playingIndex === index && "ring-viz-accent ring-2 ring-offset-2",
              )}
            >
              {label}
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

/**
 * The listening card: a big play button with what's coming ("Two notes, low then high") and,
 * for a progression, the chords in order with the one to name hidden.
 */
export function EarTrainerPlayer({
  fields,
  hasPlayed,
  isChecked,
  onPlay,
  playingIndex,
}: {
  fields: EarTrainerFields;
  hasPlayed: boolean;
  isChecked: boolean;
  onPlay: () => void;
  playingIndex: number | null;
}) {
  const t = useExtracted();
  const hint = useListenHint(fields);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3.5">
        <button
          className="bg-primary text-primary-foreground focus-visible:ring-ring/50 flex size-14 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] motion-safe:transition-transform motion-safe:active:scale-95"
          onClick={onPlay}
          onKeyDown={keepArrowKeys}
          type="button"
        >
          <Play aria-hidden="true" className="size-6 translate-x-px fill-current" />
          <span className="sr-only">{hasPlayed ? t("Play again") : t("Play")}</span>
        </button>

        <div className="flex min-w-0 flex-col">
          <p className="text-base font-semibold" aria-hidden="true">
            {hasPlayed ? t("Play again") : t("Play")}
          </p>
          <p className="text-muted-foreground text-sm">{hint}</p>
          {fields.mode === "progression" && fields.song && (
            <p className="text-muted-foreground text-sm">{fields.song}</p>
          )}
        </div>
      </div>

      {fields.mode === "progression" && (
        <ProgressionStrip fields={fields} isChecked={isChecked} playingIndex={playingIndex} />
      )}
    </div>
  );
}

"use client";

import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { Play, Square } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { ActivityCanvas, ActivityTextAlternative } from "../_components/activity-canvas";
import { ActivitySoundNote } from "../_components/activity-sound-button";
import { keepArrowKeys } from "../_utils/keep-arrow-keys";
import { pitchClassName } from "../_utils/music-notes";
import { useNoteNames } from "../_utils/use-music-labels";
import { type ActivityRendererProps } from "../activity-renderer";
import { TempoSelect, ViewToggle } from "./notation-options";
import { notationHeader, practiceTempos } from "./notation-text";
import { type NotationView, useAbcNotation } from "./use-abc-notation";
import { useNotationPlayback } from "./use-notation-playback";

type NotationPlayerProps = ActivityRendererProps<"notationPlayer">;

const PERCENT = 100;

/**
 * A short melody drawn on the staff (or with guitar tab under it) that plays while the sounding
 * note lights up. The learner can slow it down and switch views; the question below asks about
 * what they read and heard. A text version lists the notes bar by bar.
 */
export function NotationPlayerActivity({ content, labelId }: NotationPlayerProps) {
  const t = useExtracted();
  const { spoken } = useNoteNames();
  const { fields } = content;
  const header = notationHeader(fields.notation);
  const [view, setView] = useState<NotationView>(fields.view);
  const [tempo, setTempo] = useState(fields.tempo);
  const title = header.title ?? t("Melody");

  const { abcjs, containerRef, outline, status, tune } = useAbcNotation({
    label: title,
    notation: fields.notation,
    view,
  });

  const playback = useNotationPlayback({ abcjs, bpm: tempo, tune });
  const bars = outline.length;
  const progress = playback.bar && bars > 0 ? (playback.bar / bars) * PERCENT : 0;

  function changeView(next: NotationView) {
    playback.stop();
    setView(next);
  }

  function changeTempo(next: number) {
    playback.stop();
    setTempo(next);
  }

  return (
    <ActivityCanvas className="gap-4" labelId={labelId}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <p className="in-data-[mode=fun]:font-fun-display text-base leading-tight font-semibold">
            {title}
          </p>
          {header.composer && <p className="text-muted-foreground text-sm">{header.composer}</p>}
        </div>

        <ViewToggle onChange={changeView} view={view} />
      </div>

      {status === "loading" && <Skeleton className="h-40 w-full rounded-2xl" />}

      {status === "failed" && (
        <p className="text-muted-foreground text-sm">
          {t("The music couldn't load. Check your connection and try again.")}
        </p>
      )}

      <div
        className={cn(
          "text-foreground [&_.notation-playing]:fill-viz-accent [&_.notation-playing]:stroke-viz-accent w-full",
          status !== "ready" && "hidden",
        )}
        ref={containerRef}
      />

      <div className="flex items-center gap-3">
        <button
          aria-label={playback.isPlaying ? t("Stop") : t("Play the melody")}
          className="bg-primary text-primary-foreground focus-visible:ring-ring/50 flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] disabled:opacity-50"
          disabled={status !== "ready"}
          onClick={playback.isPlaying ? playback.stop : playback.play}
          onKeyDown={keepArrowKeys}
          type="button"
        >
          {playback.isPlaying ? (
            <Square aria-hidden="true" className="size-4 fill-current" />
          ) : (
            <Play aria-hidden="true" className="size-5 translate-x-px fill-current" />
          )}
        </button>

        <div className="flex flex-1 flex-col gap-1.5">
          <div aria-hidden="true" className="bg-border h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-viz-secondary h-full rounded-full motion-safe:transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p aria-live="polite" className="text-muted-foreground text-xs tabular-nums">
            {playback.bar
              ? t("Bar {bar} of {bars}", { bar: String(playback.bar), bars: String(bars) })
              : t("{bars, plural, one {# bar} other {# bars}}", { bars })}
          </p>
        </div>

        <TempoSelect onChange={changeTempo} tempo={tempo} tempos={practiceTempos(fields.tempo)} />
      </div>

      <ActivitySoundNote status={playback.sound} />

      <ActivityTextAlternative>
        {outline
          .map((notes, index) =>
            t("Bar {bar}: {notes}.", {
              bar: String(index + 1),
              notes: notes.map((midi) => spoken(pitchClassName(midi))).join(", "),
            }),
          )
          .join(" ")}
      </ActivityTextAlternative>
    </ActivityCanvas>
  );
}

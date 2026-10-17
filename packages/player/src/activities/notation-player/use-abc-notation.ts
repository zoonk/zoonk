"use client";

import { useMeasuredWidth } from "@zoonk/ui/hooks/measured-width";
import { type NoteTimingEvent, type TimingCallbacks, type TuneObject, type renderAbc } from "abcjs";
import { useEffect, useState } from "react";
import { type SoundEvent } from "../_utils/sound-events";
import { notationToDraw } from "./notation-text";

type Abcjs = { TimingCallbacks: typeof TimingCallbacks; renderAbc: typeof renderAbc };

export type NotationView = "staff" | "tab";

type NotationStatus = "failed" | "loading" | "ready";

const SECONDS_PER_MINUTE = 60;
const DEFAULT_WIDTH = 320;

/** The staff is drawn at the width it's shown, so notes keep their size on a phone. */
const STAFF_MARGIN = 12;
const WIDE_STAFF = 480;
const BARS_PER_NARROW_LINE = 2;
const BARS_PER_WIDE_LINE = 4;
const MIN_SPACING = 1.8;
const MAX_SPACING = 2.7;
const MS = 1000;

/** The notes of a timed tune as sound events, each ringing for its written length. */
export function tuneSound({
  bpm,
  beatLength,
  events,
}: {
  beatLength: number;
  bpm: number;
  events: readonly NoteTimingEvent[];
}): SoundEvent[] {
  const secondsPerWhole = SECONDS_PER_MINUTE / bpm / beatLength;

  return events.flatMap((event) =>
    (event.midiPitches ?? []).map((pitch) => ({
      at: event.milliseconds / MS,
      duration: pitch.duration * secondsPerWhole,
      midi: pitch.pitch,
    })),
  );
}

/** The tune bar by bar, as the notes' MIDI numbers, for the words that describe it. */
type TuneOutline = number[][];

function outlineTune(abcjs: Abcjs, tune: TuneObject): TuneOutline {
  const events = new abcjs.TimingCallbacks(tune, {}).noteTimings.filter(
    (event) => event.type === "event" && (event.midiPitches?.length ?? 0) > 0,
  );

  const bars = Math.max(0, ...events.map((event) => event.measureNumber ?? 0)) + 1;

  return Array.from({ length: bars }, (_, bar) =>
    events
      .filter((event) => (event.measureNumber ?? 0) === bar)
      .flatMap((event) => (event.midiPitches ?? []).map((pitch) => pitch.pitch)),
  );
}

/**
 * Draws ABC notation with abcjs (loaded only for this activity), as a staff or with guitar tab
 * under it, in the text color so it follows light and dark. The tune comes back ready to play:
 * its notes carry their pitches.
 */
export function useAbcNotation({
  label,
  notation,
  view,
}: {
  label: string;
  notation: string;
  view: NotationView;
}) {
  const { ref: containerRef, width } = useMeasuredWidth<HTMLDivElement>(DEFAULT_WIDTH);

  const [loaded, setLoaded] = useState<{
    abcjs: Abcjs;
    outline: TuneOutline;
    tune: TuneObject;
  } | null>(null);

  const [status, setStatus] = useState<NotationStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();

    import("abcjs").then(
      (abcjs) => {
        const container = containerRef.current;

        if (controller.signal.aborted || !container) {
          return;
        }

        const [tune] = abcjs.renderAbc(container, notationToDraw(notation), {
          add_classes: true,
          ariaLabel: label,
          foregroundColor: "currentColor",
          paddingbottom: 0,
          paddingleft: 0,
          paddingright: 0,
          paddingtop: 0,
          responsive: "resize",
          staffwidth: width - STAFF_MARGIN,
          tablature: view === "tab" ? [{ instrument: "guitar", label: " " }] : undefined,
          wrap: {
            maxSpacing: MAX_SPACING,
            minSpacing: MIN_SPACING,
            preferredMeasuresPerLine:
              width < WIDE_STAFF ? BARS_PER_NARROW_LINE : BARS_PER_WIDE_LINE,
          },
        });

        tune.setUpAudio({});
        setLoaded({ abcjs, outline: outlineTune(abcjs, tune), tune });
        setStatus("ready");
      },
      () => !controller.signal.aborted && setStatus("failed"),
    );

    return () => controller.abort();
  }, [containerRef, label, notation, view, width]);

  return {
    abcjs: loaded?.abcjs ?? null,
    containerRef,
    outline: loaded?.outline ?? [],
    status,
    tune: loaded?.tune ?? null,
  };
}

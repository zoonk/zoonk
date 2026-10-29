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

const STAFF_MARGIN = 12;
const WIDE_STAFF = 480;
const BARS_PER_NARROW_LINE = 2;
const BARS_PER_WIDE_LINE = 4;
const MIN_SPACING = 1.8;
const MAX_SPACING = 2.7;
const MS = 1000;

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

type TuneOutline = number[][];

const MAX_LINES = 64;
const MAX_SECTIONS = 16;

/**
 * abcjs drops the guitar tab when it wraps lines itself (https://github.com/paulrosen/abcjs/issues/1195),
 * so the tab view breaks its lines at fixed measures instead: abcjs reads one list per section of
 * the tune, each the last measure of every line.
 */
function lineLayout({ barsPerLine, view }: { barsPerLine: number; view: NotationView }) {
  if (view === "tab") {
    const breaks = Array.from({ length: MAX_SECTIONS }, () =>
      Array.from({ length: MAX_LINES }, (_, line) => (line + 1) * barsPerLine - 1),
    );

    return {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- abcjs's types declare a flat list, but its parser reads one list per section (https://github.com/paulrosen/abcjs/issues/1196).
      lineBreaks: breaks as unknown as number[],
      tablature: [{ instrument: "guitar" as const, label: " " }],
    };
  }

  return {
    wrap: {
      maxSpacing: MAX_SPACING,
      minSpacing: MIN_SPACING,
      preferredMeasuresPerLine: barsPerLine,
    },
  };
}

function outlineTune(abcjs: Abcjs, tune: TuneObject): TuneOutline {
  const events = new abcjs.TimingCallbacks(tune, {}).noteTimings.filter(
    (event) => event.type === "event" && (event.midiPitches?.length ?? 0) > 0,
  );

  const bars = Math.max(0, ...events.map((event) => event.measureNumber ?? 0)) + 1;
  const outline: TuneOutline = Array.from({ length: bars }, () => []);
  const left = new Set<number>();
  let playing: number | null = null;

  // Timings follow playback, so a repeat plays its bars again; each written bar keeps its first pass.
  for (const event of events) {
    const bar = event.measureNumber ?? 0;

    if (bar !== playing && playing !== null) {
      left.add(playing);
    }

    playing = bar;

    if (!left.has(bar)) {
      outline[bar]?.push(...(event.midiPitches ?? []).map((pitch) => pitch.pitch));
    }
  }

  return outline;
}

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

        const barsPerLine = width < WIDE_STAFF ? BARS_PER_NARROW_LINE : BARS_PER_WIDE_LINE;

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
          ...lineLayout({ barsPerLine, view }),
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

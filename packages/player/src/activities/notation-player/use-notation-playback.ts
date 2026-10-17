"use client";

import { type NoteTimingEvent, type TimingCallbacks, type TuneObject, type renderAbc } from "abcjs";
import { useEffect, useRef, useState } from "react";
import { useInstrument } from "../_utils/use-instrument";
import { tuneSound } from "./use-abc-notation";

type Abcjs = { TimingCallbacks: typeof TimingCallbacks; renderAbc: typeof renderAbc };

const PLAYING_CLASS = "notation-playing";

function eventElements(event: NoteTimingEvent): Element[] {
  return (event.elements ?? []).flat();
}

/**
 * Plays a drawn tune on the piano and follows it on the page: the sounding note lights up and
 * the bar number counts along. Audio and the highlight start together on the same beat.
 */
export function useNotationPlayback({
  abcjs,
  bpm,
  tune,
}: {
  abcjs: Abcjs | null;
  bpm: number;
  tune: TuneObject | null;
}) {
  const piano = useInstrument("piano");
  const [bar, setBar] = useState<number | null>(null);
  const timing = useRef<TimingCallbacks | null>(null);
  const lit = useRef<Element[]>([]);

  function light(elements: Element[]) {
    lit.current.forEach((element) => element.classList.remove(PLAYING_CLASS));
    elements.forEach((element) => element.classList.add(PLAYING_CLASS));
    lit.current = elements;
  }

  function stop() {
    timing.current?.stop();
    timing.current = null;
    piano.stop();
    light([]);
    setBar(null);
  }

  useEffect(
    () => () => {
      timing.current?.stop();
      lit.current.forEach((element) => element.classList.remove(PLAYING_CLASS));
    },
    [],
  );

  function play() {
    if (!abcjs || !tune) {
      return;
    }

    stop();

    const callbacks = new abcjs.TimingCallbacks(tune, {
      eventCallback: (event) => {
        if (!event) {
          stop();
          return;
        }

        light(eventElements(event));
        setBar((event.measureNumber ?? 0) + 1);
      },
      qpm: bpm,
    });

    const events = callbacks.noteTimings.filter((event) => event.type === "event");

    timing.current = callbacks;
    setBar(1);
    void piano.play(tuneSound({ beatLength: tune.getBeatLength(), bpm, events }));
    callbacks.start();
  }

  return { bar, isPlaying: bar !== null, play, sound: piano.status, stop };
}

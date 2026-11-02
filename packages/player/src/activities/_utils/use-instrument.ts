"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getActivityAudioContext, startActivityAudio } from "./activity-audio";
import { type SoundEvent } from "./sound-events";

type InstrumentName = "guitar" | "piano";

type StopNote = () => void;

type Voice = {
  start: (note: { duration?: number; note: number; time?: number; velocity?: number }) => StopNote;
};

const PIANO_VELOCITY = 76;
const PIANO_LOWEST = 36;
const PIANO_HIGHEST = 96;

const PIANO_NOTES = Array.from(
  { length: PIANO_HIGHEST - PIANO_LOWEST + 1 },
  (_, index) => PIANO_LOWEST + index,
);

const loads = new Map<InstrumentName, Promise<Voice>>();

async function loadVoice(name: InstrumentName): Promise<Voice> {
  const { Soundfont: soundfont, SplendidGrandPiano: splendidGrandPiano } = await import("smplr");
  const context = getActivityAudioContext();

  const instrument =
    name === "piano"
      ? splendidGrandPiano(context, {
          notesToLoad: { notes: PIANO_NOTES, velocityRange: [PIANO_VELOCITY, PIANO_VELOCITY] },
          velocity: PIANO_VELOCITY,
        })
      : soundfont(context, { instrument: "acoustic_guitar_steel", kit: "FluidR3_GM" });

  await instrument.ready;
  return instrument;
}

function getVoice(name: InstrumentName): Promise<Voice> {
  const existing = loads.get(name);

  if (existing) {
    return existing;
  }

  const load = loadVoice(name);
  loads.set(name, load);

  load.catch(() => loads.delete(name));

  return load;
}

const DEFAULT_DURATION = 1.2;
const SCHEDULE_AHEAD = 0.03;

export type InstrumentStatus = "loading" | "ready" | "unavailable";

export function useInstrument(name: InstrumentName) {
  const [status, setStatus] = useState<InstrumentStatus>("loading");
  const plays = useRef(0);
  const notes = useRef<StopNote[]>([]);

  useEffect(() => {
    const controller = new AbortController();

    getVoice(name).then(
      () => !controller.signal.aborted && setStatus("ready"),
      () => !controller.signal.aborted && setStatus("unavailable"),
    );

    return () => controller.abort();
  }, [name]);

  // The voice is shared by every screen, so this stops only the notes this one started, queued ones
  // included (the voice's own stop leaves notes queued past its lookahead), and drops a play still
  // starting. It also runs when the screen is hidden or gone.
  const stop = useCallback(() => {
    plays.current += 1;
    notes.current.forEach((stopNote) => stopNote());
    notes.current = [];
  }, []);

  useEffect(() => stop, [stop]);

  const play = useCallback(
    async (events: readonly SoundEvent[], duration = DEFAULT_DURATION) => {
      const played = plays.current;

      const [context, voice] = await Promise.all([startActivityAudio(), getVoice(name)]).catch(
        () => [null, null] as const,
      );

      if (played !== plays.current) {
        return;
      }

      if (!context || !voice) {
        setStatus("unavailable");
        return;
      }

      const start = context.currentTime + SCHEDULE_AHEAD;

      notes.current.push(
        ...events.map((event) =>
          voice.start({
            duration: event.duration ?? duration,
            note: event.midi,
            time: start + event.at,
          }),
        ),
      );
    },
    [name],
  );

  return { play, status, stop };
}

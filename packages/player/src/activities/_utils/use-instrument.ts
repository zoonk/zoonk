"use client";

import { useCallback, useEffect, useState } from "react";
import { getActivityAudioContext, startActivityAudio } from "./activity-audio";
import { type SoundEvent } from "./sound-events";

type InstrumentName = "guitar" | "piano";

type Voice = {
  start: (note: { duration?: number; note: number; time?: number; velocity?: number }) => unknown;
  stop: () => void;
};

/** One velocity layer is enough to hear notes and keeps the download small. */
const PIANO_VELOCITY = 76;
const PIANO_LOWEST = 36;
const PIANO_HIGHEST = 96;

const PIANO_NOTES = Array.from(
  { length: PIANO_HIGHEST - PIANO_LOWEST + 1 },
  (_, index) => PIANO_LOWEST + index,
);

const loads = new Map<InstrumentName, Promise<Voice>>();

/**
 * Loads sampled instruments on first use: smplr is only downloaded for music activities, and
 * the samples come from its public sample host.
 */
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

  /* A failed download can be retried the next time the learner asks for sound. */
  load.catch(() => loads.delete(name));

  return load;
}

const DEFAULT_DURATION = 1.2;
const SCHEDULE_AHEAD = 0.03;

export type InstrumentStatus = "loading" | "ready" | "unavailable";

/**
 * Plays notes on a sampled instrument, each at its time in the sound. Samples start loading when the activity
 * appears, so the first tap sounds right away; when they can't load, `status` says so and the
 * activity still works without sound.
 */
export function useInstrument(name: InstrumentName) {
  const [status, setStatus] = useState<InstrumentStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();

    getVoice(name).then(
      () => !controller.signal.aborted && setStatus("ready"),
      () => !controller.signal.aborted && setStatus("unavailable"),
    );

    return () => controller.abort();
  }, [name]);

  const play = useCallback(
    async (events: readonly SoundEvent[], duration = DEFAULT_DURATION) => {
      const [context, voice] = await Promise.all([startActivityAudio(), getVoice(name)]).catch(
        () => [null, null] as const,
      );

      if (!context || !voice) {
        setStatus("unavailable");
        return;
      }

      const start = context.currentTime + SCHEDULE_AHEAD;

      events.forEach((event) => {
        voice.start({
          duration: event.duration ?? duration,
          note: event.midi,
          time: start + event.at,
        });
      });
    },
    [name],
  );

  const stop = useCallback(() => {
    void getVoice(name).then(
      (voice) => voice.stop(),
      () => null,
    );
  }, [name]);

  return { play, status, stop };
}

"use client";

import { createContext, use, useEffect, useMemo } from "react";
import { type HelpLimit } from "../_components/help-limit-notice";

/** A clip to play, or why there's none: today's help used up, or a failure worth retrying. */
export type SpeechClipOutcome =
  | { status: "ready"; url: string }
  | { limit: HelpLimit | null; status: "failed" };

/**
 * How the host app gets text read aloud: from the learner's tap to its API, which returns the
 * shared clip or voices it the first time anyone asks. Never called on render or page load.
 */
export type VoiceText = (input: { language: string; text: string }) => Promise<SpeechClipOutcome>;

type PlaybackEnd = "ended" | "failed" | "stopped";

/** Who started the clip playing, so a screen only stops its own sound. */
type PlaybackOwner = object;

type SpeechPlayer = {
  /** The clip for the text, asked for once per page however often it plays. */
  load: VoiceText;
  play: (input: {
    onStart: () => void;
    owner: PlaybackOwner;
    rate: number;
    url: string;
  }) => Promise<PlaybackEnd>;
  stop: (owner: PlaybackOwner) => void;
  /** Lets the shared element play later, after the clip arrives; call it inside the tap. */
  unlock: () => void;
};

/**
 * A tenth of a second of silence. Mobile Safari only lets an element play sound it started inside
 * a tap; playing this inside the tap lets the clip play on that element once it has loaded.
 */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

const SpeechPlayerContext = createContext<SpeechPlayer | null>(null);

function clipKey({ language, text }: { language: string; text: string }): string {
  return `${language}\n${text}`;
}

type Playback = { finish: (end: PlaybackEnd) => void; owner: PlaybackOwner };

/**
 * One audio element for every spoken clip on the page, so only one sound plays at a time:
 * starting a clip stops whatever was playing, and its screen hears that it stopped.
 */
function createSpeechPlayer(voice: VoiceText): SpeechPlayer & { dispose: () => void } {
  const clips = new Map<string, Promise<SpeechClipOutcome>>();
  let audio: HTMLAudioElement | null = null;
  let current: Playback | null = null;
  let isUnlocked = false;

  const getAudio = () => {
    audio ??= new Audio();
    return audio;
  };

  const load: VoiceText = (input) => {
    const key = clipKey(input);
    const cached = clips.get(key);

    if (cached) {
      return cached;
    }

    const loading = voice(input).then((outcome) => {
      // A failure isn't kept, so trying again asks again.
      if (outcome.status !== "ready") {
        clips.delete(key);
      }

      return outcome;
    });

    clips.set(key, loading);
    return loading;
  };

  const stopCurrent = () => {
    const playing = current;
    current = null;
    audio?.pause();
    playing?.finish("stopped");
  };

  const play: SpeechPlayer["play"] = ({ onStart, owner, rate, url }) => {
    stopCurrent();
    const element = getAudio();

    return new Promise<PlaybackEnd>((resolve) => {
      const finish = (end: PlaybackEnd) => {
        element.removeEventListener("ended", onEnded);
        element.removeEventListener("error", onError);

        if (current?.finish === finish) {
          current = null;
        }

        resolve(end);
      };

      const onEnded = () => finish("ended");
      const onError = () => finish("failed");
      const playback: Playback = { finish, owner };

      current = playback;
      element.addEventListener("ended", onEnded);
      element.addEventListener("error", onError);
      element.src = url;
      element.preservesPitch = true;
      // Loading a source resets the rate to the default one, so both are set.
      element.defaultPlaybackRate = rate;
      element.playbackRate = rate;

      element.play().then(
        () => {
          if (current === playback) {
            onStart();
          }
        },
        () => {
          if (current === playback) {
            finish("failed");
          }
        },
      );
    });
  };

  const stop = (owner: PlaybackOwner) => {
    if (current?.owner === owner) {
      stopCurrent();
    }
  };

  const unlock = () => {
    if (isUnlocked) {
      return;
    }

    isUnlocked = true;
    const element = getAudio();
    element.src = SILENT_WAV;
    element.play().catch(() => null);
  };

  const dispose = () => {
    stopCurrent();
    audio?.removeAttribute("src");
    audio?.load();
  };

  return { dispose, load, play, stop, unlock };
}

/**
 * Gives every learn screen and the lesson player one way to hear text in its language: the host
 * app's `voice` returns a generated clip, and one shared element plays it. Mount it once, above
 * every screen that speaks, with a `voice` that keeps its identity (a module-level function).
 */
export function SpeechPlayerProvider({
  children,
  voice,
}: {
  children: React.ReactNode;
  voice: VoiceText;
}) {
  const player = useMemo(() => createSpeechPlayer(voice), [voice]);

  useEffect(() => () => player.dispose(), [player]);

  return <SpeechPlayerContext value={player}>{children}</SpeechPlayerContext>;
}

/** The page's speech player, or null when the host app gives screens no voice. */
export function useSpeechPlayer(): SpeechPlayer | null {
  return use(SpeechPlayerContext);
}

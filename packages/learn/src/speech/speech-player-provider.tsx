"use client";

import { createContext, use, useEffect, useMemo } from "react";
import { type HelpLimit } from "../_components/help-limit-notice";

export type SpeechClipOutcome =
  | { status: "ready"; url: string }
  | { limit: HelpLimit | null; status: "failed" };

/**
 * Called only from the learner's tap, never on render or page load. `personal` words get a clip of
 * the learner's own.
 */
export type VoiceText = (input: {
  language: string;
  personal?: boolean;
  text: string;
}) => Promise<SpeechClipOutcome>;

type PlaybackEnd = "ended" | "failed" | "stopped";

type PlaybackOwner = object;

type SpeechPlayer = {
  load: VoiceText;
  play: (input: {
    onStart: () => void;
    owner: PlaybackOwner;
    rate: number;
    url: string;
  }) => Promise<PlaybackEnd>;
  stop: (owner: PlaybackOwner) => void;
  /** Call it inside the tap, so the shared element may play the clip once it arrives. */
  unlock: () => void;
};

/**
 * Mobile Safari only lets an element play sound it started inside a tap, so this plays there first.
 */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

const SpeechPlayerContext = createContext<SpeechPlayer | null>(null);

function clipKey({ language, personal = false, text }: Parameters<VoiceText>[0]): string {
  return `${language}\n${String(personal)}\n${text}`;
}

type Playback = { finish: (end: PlaybackEnd) => void; owner: PlaybackOwner };

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

/** Mount it once, above every screen that speaks, with a `voice` that keeps its identity. */
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

export function useSpeechPlayer(): SpeechPlayer | null {
  return use(SpeechPlayerContext);
}

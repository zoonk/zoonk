"use client";

import { getBaseLanguage, isTTSSupportedLanguage } from "@zoonk/utils/languages";
import { useCallback, useEffect, useRef, useState } from "react";
import { type HelpLimit } from "../_components/help-limit-notice";
import { type SpeechClipOutcome, useSpeechPlayer } from "./speech-player-provider";

export type SpokenText = string | { audioUrl: string | null; personal?: boolean; text: string };

export type SpokenAudioState =
  | { status: "idle" | "loading" | "playing" }
  | { limit: HelpLimit | null; status: "failed" };

type SpeakInput = {
  from?: number;
  onDone?: () => void;
  onSegment?: (index: number) => void;
  rate?: number;
  segments: readonly SpokenText[];
};

type SpeechPlayer = NonNullable<ReturnType<typeof useSpeechPlayer>>;

type Reading = Required<Pick<SpeakInput, "rate">> &
  Pick<SpeakInput, "onDone" | "onSegment"> & {
    isCurrent: () => boolean;
    language: string;
    owner: object;
    player: SpeechPlayer;
    segments: readonly SpokenText[];
    setState: (state: SpokenAudioState) => void;
  };

const IDLE: SpokenAudioState = { status: "idle" };
const LOADING: SpokenAudioState = { status: "loading" };
const PLAYING: SpokenAudioState = { status: "playing" };

function loadSegment({
  language,
  player,
  segment,
}: {
  language: string;
  player: SpeechPlayer;
  segment: SpokenText;
}): Promise<SpeechClipOutcome> {
  if (typeof segment === "string") {
    return player.load({ language, text: segment });
  }

  return segment.audioUrl
    ? Promise.resolve({ status: "ready", url: segment.audioUrl })
    : player.load({ language, text: segment.text, ...(segment.personal && { personal: true }) });
}

function withoutRecording(segments: readonly SpokenText[], index: number): SpokenText[] {
  return segments.map((segment, position) =>
    position === index && typeof segment !== "string" ? segment.text : segment,
  );
}

async function readFrom(reading: Reading, index: number): Promise<void> {
  const segment = reading.segments[index];

  if (segment === undefined) {
    reading.setState(IDLE);
    reading.onDone?.();
    return;
  }

  const clip = await loadSegment({ ...reading, segment });

  if (!reading.isCurrent()) {
    return;
  }

  if (clip.status === "failed") {
    reading.setState(clip);
    return;
  }

  const next = reading.segments[index + 1];

  if (next !== undefined) {
    void loadSegment({ ...reading, segment: next });
  }

  const end = await reading.player.play({
    onStart: () => {
      if (reading.isCurrent()) {
        reading.setState(PLAYING);
        reading.onSegment?.(index);
      }
    },
    owner: reading.owner,
    rate: reading.rate,
    url: clip.url,
  });

  if (!reading.isCurrent()) {
    return;
  }

  if (end === "ended") {
    await readFrom(reading, index + 1);
    return;
  }

  if (end === "failed" && typeof segment !== "string" && segment.audioUrl) {
    await readFrom({ ...reading, segments: withoutRecording(reading.segments, index) }, index);
    return;
  }

  reading.setState(end === "failed" ? { limit: null, status: "failed" } : IDLE);
}

/** The clip is asked for on the learner's tap (`speak`), never on render. */
export function useSpokenAudio(language: string) {
  const player = useSpeechPlayer();
  const [state, setState] = useState<SpokenAudioState>(IDLE);
  const runRef = useRef(0);
  const ownerRef = useRef<object>({});

  const cancel = useCallback(() => {
    runRef.current += 1;
    player?.stop(ownerRef.current);
    setState(IDLE);
  }, [player]);

  const speak = useCallback(
    ({ from = 0, onDone, onSegment, rate = 1, segments }: SpeakInput) => {
      if (!player) {
        return;
      }

      runRef.current += 1;
      const run = runRef.current;

      player.unlock();
      player.stop(ownerRef.current);
      setState(LOADING);

      void readFrom(
        {
          isCurrent: () => runRef.current === run,
          language,
          onDone,
          onSegment,
          owner: ownerRef.current,
          player,
          rate,
          segments,
          setState,
        },
        from,
      );
    },
    [language, player],
  );

  useEffect(
    () => () => {
      runRef.current += 1;
      player?.stop(ownerRef.current);
    },
    [player],
  );

  return {
    cancel,
    isAvailable: player !== null && isTTSSupportedLanguage(getBaseLanguage(language)),
    speak,
    state,
  };
}

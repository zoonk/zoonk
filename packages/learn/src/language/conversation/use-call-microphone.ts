"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type SpeechSample, sampleSpeech } from "./speech-activity";

function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/** Called on fail, end and close; an AudioContext closes only once. */
function closeContext(context: AudioContext) {
  if (context.state !== "closed") {
    void context.close().catch(() => null);
  }
}

/** `blocked`: the learner or the browser refused it. `unavailable`: there's none, or another app holds it. */
export type MicrophoneProblem = "blocked" | "unavailable";

export type CallAudio = {
  blocked: boolean;
  /** Reports whether the learner is speaking until the audio stops. */
  hear: (onSample: (sample: SpeechSample) => void) => void;
  stop: () => void;
  stream: MediaStream;
};

/**
 * Call it in a tap: Safari on iOS asks for the microphone, and starts the context that hears the
 * learner, only during one.
 */
export async function openCallAudio(): Promise<CallAudio | MicrophoneProblem> {
  const context = new AudioContext();
  void context.resume().catch(() => null);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const hearing: (() => void)[] = [];

    return {
      blocked: false,
      hear: (onSample) => {
        hearing.push(sampleSpeech({ context, onSample, stream }));
      },
      stop: () => {
        for (const stopHearing of hearing.splice(0)) {
          stopHearing();
        }

        stopTracks(stream);
        closeContext(context);
      },
      stream,
    };
  } catch (error) {
    closeContext(context);
    const refused = error instanceof DOMException && error.name === "NotAllowedError";
    return refused ? "blocked" : "unavailable";
  }
}

/** Silence for a call made by typing: a GPT-Live session only moves on while audio streams in. */
export function openTypedCallAudio(): CallAudio {
  const context = new AudioContext();
  const silence = context.createConstantSource();
  const destination = context.createMediaStreamDestination();
  silence.offset.value = 0;
  silence.connect(destination);
  silence.start();

  return {
    blocked: true,
    hear: () => {
      // A blocked microphone never counts as speaking.
    },
    stop: () => {
      stopTracks(destination.stream);
      closeContext(context);
    },
    stream: destination.stream,
  };
}

/** The intro's tap opens the audio and hands it to the call, which takes it once. */
export function holdCallAudio(audio: CallAudio) {
  const held: { audio: CallAudio | null } = { audio };

  const take = () => {
    const taken = held.audio;
    held.audio = null;
    return taken;
  };

  return { release: () => take()?.stop(), take };
}

export type TappedCallAudio = ReturnType<typeof holdCallAudio>;

/** It must not close when the session is set: GPT-Live needs the audio before it says a word. */
export function useCallMicrophone() {
  const [blocked, setBlocked] = useState(false);
  const stopAudio = useRef<(() => void) | null>(null);
  const screenClosed = useRef(false);

  const keep = useCallback((audio: CallAudio): boolean => {
    if (screenClosed.current) {
      audio.stop();
      return false;
    }

    stopAudio.current = audio.stop;
    setBlocked(audio.blocked);
    return true;
  }, []);

  const stop = useCallback(() => stopAudio.current?.(), []);

  // React reruns this cleanup and setup without unmounting (Strict Mode, Activity), so setup
  // reopens the screen, or every later call would drop its audio.
  useEffect(() => {
    screenClosed.current = false;

    return () => {
      screenClosed.current = true;
      stopAudio.current?.();
    };
  }, []);

  return { blocked, keep, stop };
}

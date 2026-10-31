"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/**
 * Silence when the microphone is blocked: a GPT-Live session only moves on while audio streams in.
 */
export async function openCallAudio(): Promise<{
  blocked: boolean;
  stop: () => void;
  stream: MediaStream;
}> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return { blocked: false, stop: () => stopTracks(stream), stream };
  } catch {
    const context = new AudioContext();
    const silence = context.createConstantSource();
    const destination = context.createMediaStreamDestination();
    silence.offset.value = 0;
    silence.connect(destination);
    silence.start();

    return {
      blocked: true,
      // Called on fail, end and close; an AudioContext closes only once.
      stop: () => {
        stopTracks(destination.stream);

        if (context.state !== "closed") {
          void context.close().catch(() => null);
        }
      },
      stream: destination.stream,
    };
  }
}

export type CallAudio = Awaited<ReturnType<typeof openCallAudio>>;

/**
 * Safari on iOS asks for the microphone only while a tap is active, so the tap opens it before the
 * call's screen exists. It's taken once.
 */
export function openCallAudioInTap() {
  const held: { audio: Promise<CallAudio> | null } = { audio: openCallAudio() };

  const take = () => {
    const { audio } = held;
    held.audio = null;
    return audio;
  };

  return { release: () => void take()?.then((audio) => audio.stop()), take };
}

export type TappedCallAudio = ReturnType<typeof openCallAudioInTap>;

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

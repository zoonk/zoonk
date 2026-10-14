"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function stopTracks(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/**
 * The learner's microphone, or silence when it's blocked. A GPT-Live session only moves on while
 * audio streams in, so a call the learner types in still sends silence.
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
      // The call stops its audio when it fails, ends and closes: only the first stop closes it.
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
 * The call's microphone: open for the whole call, closed when the call fails or ends and when the
 * screen closes, even a screen left while the call was still opening. It must not close when the
 * session is set: that would cut the audio GPT-Live needs before it says a word.
 */
export function useCallMicrophone() {
  const [blocked, setBlocked] = useState(false);
  const stopAudio = useRef<(() => void) | null>(null);
  const screenClosed = useRef(false);

  /** Keeps the audio for the call; false when the screen closed meanwhile, and the audio with it. */
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

  // React runs this cleanup and setup again without unmounting (Strict Mode in development, a
  // screen kept hidden in an Activity and shown again), so setup reopens the screen: otherwise
  // every later call would drop its audio and never connect.
  useEffect(() => {
    screenClosed.current = false;

    return () => {
      screenClosed.current = true;
      stopAudio.current?.();
    };
  }, []);

  return { blocked, keep, stop };
}

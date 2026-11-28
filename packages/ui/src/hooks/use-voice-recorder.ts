"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useCallback, useEffect, useRef, useState } from "react";
import { type MicrophoneLevel, listenToLevel } from "../lib/microphone-level";
import { useIsMounted } from "./use-is-mounted";

/** A spoken answer is one sentence; a longer recording is a microphone left on. */
const MAX_RECORDING_MS = 30_000;
const TICK_MS = 250;
/** The most the grader takes as the microphone's startup; a longer wait isn't one it can use. */
const MAX_STARTUP_MS = 60_000;

/** Formats the grader accepts. */
const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

type RecorderStatus = "acquiring" | "denied" | "idle" | "recording";

/** `micStartupMs`: from the press on Record to the recorder going live, when it was measured. */
export type Recording = { audio: Blob; durationMs: number; micStartupMs?: number };

/** `blocked`: the learner or the browser refused it. `unavailable`: there's none, or another app holds it. */
export type MicrophoneProblem = "blocked" | "unavailable";

/** Reads what `getUserMedia` rejected with. */
export function getMicrophoneProblem(error: unknown): MicrophoneProblem {
  return error instanceof DOMException && error.name === "NotAllowedError"
    ? "blocked"
    : "unavailable";
}

function canRecord(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof globalThis.navigator?.mediaDevices?.getUserMedia === "function"
  );
}

export function useCanRecord(): boolean {
  return useIsMounted() && canRecord();
}

function getRecordingType(): string | undefined {
  return RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

export function stopTracks(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

/** The level meter is extra: a browser that can't measure the stream still records it. */
function openContext(): AudioContext | null {
  try {
    const context = new AudioContext();
    void context.resume().catch(() => null);
    return context;
  } catch {
    return null;
  }
}

function listenSafely(context: AudioContext | null, stream: MediaStream): MicrophoneLevel | null {
  try {
    return context ? listenToLevel({ context, stream }) : null;
  } catch {
    return null;
  }
}

type ActiveRecording = {
  level: MicrophoneLevel | null;
  live: ReturnType<typeof Promise.withResolvers<boolean>>;
  /** On the monotonic clock, for the startup the grader reads. */
  liveAt: number | null;
  recorder: MediaRecorder;
  released: boolean;
  /** On the wall clock, for the clock the learner reads. */
  startedAt: number | null;
  stream: MediaStream;
  timeout: ReturnType<typeof setTimeout>;
};

function finishRecording(active: ActiveRecording) {
  if (active.released) {
    return;
  }

  active.released = true;
  active.live.resolve(false);
  globalThis.clearTimeout(active.timeout);
  active.level?.stop();

  if (active.recorder.state !== "inactive") {
    active.recorder.stop();
  }

  stopTracks(active.stream);
}

/**
 * Live is the recorder's own start with sound coming in: a track starts muted while some devices,
 * such as Bluetooth headphones, switch to their microphone.
 */
function createRecording({
  level,
  onStopped,
  stream,
}: {
  level: MicrophoneLevel | null;
  onStopped: (recording: Omit<Recording, "micStartupMs">) => void;
  stream: MediaStream;
}): ActiveRecording {
  const chunks: Blob[] = [];
  const type = getRecordingType();
  const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);

  const active: ActiveRecording = {
    level,
    live: Promise.withResolvers<boolean>(),
    liveAt: null,
    recorder,
    released: false,
    startedAt: null,
    stream,
    timeout: globalThis.setTimeout(() => finishRecording(active), MAX_RECORDING_MS),
  };

  const goLive = () => {
    if (!active.released) {
      active.liveAt = performance.now();
      active.startedAt = Date.now();
      active.live.resolve(true);
    }
  };

  recorder.addEventListener("start", () => {
    const [track] = stream.getAudioTracks();

    if (track?.muted) {
      track.addEventListener("unmute", goLive, { once: true });
    } else {
      goLive();
    }
  });

  recorder.addEventListener("dataavailable", (event) => chunks.push(event.data));

  recorder.addEventListener("stop", () => {
    finishRecording(active);

    if (active.startedAt !== null) {
      onStopped({
        audio: new Blob(chunks, { type: recorder.mimeType }),
        durationMs: Date.now() - active.startedAt,
      });
    }
  });

  return active;
}

type StartResult = MicrophoneProblem | "recording" | null;

type Take = { active?: ActiveRecording; context: AudioContext | null; pressedAt: number };

function closeTake(take: Take) {
  if (take.active) {
    finishRecording(take.active);
  }

  if (take.context && take.context.state !== "closed") {
    void take.context.close().catch(() => null);
  }
}

function getStartupMs(take: Take): number | undefined {
  const liveAt = take.active?.liveAt;
  const startupMs = liveAt === null || liveAt === undefined ? null : liveAt - take.pressedAt;
  return startupMs === null || startupMs > MAX_STARTUP_MS ? undefined : Math.round(startupMs);
}

/**
 * The microphone opens on Record and closes at Stop. `readLevel` is the live input's level while
 * recording, for a meter that moves with the learner's voice.
 */
export function useVoiceRecorder({ onRecorded }: { onRecorded: (recording: Recording) => void }) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const takeRef = useRef<Take | null>(null);

  const release = useCallback(() => {
    const take = takeRef.current;
    takeRef.current = null;

    if (take) {
      closeTake(take);
    }
  }, []);

  const open = useCallback(
    async (take: Take): Promise<StartResult> => {
      const { data: stream, error } = await safeAsync(() =>
        navigator.mediaDevices.getUserMedia({ audio: true }),
      );

      if (takeRef.current !== take) {
        if (stream) {
          stopTracks(stream);
        }

        return null;
      }

      if (!stream) {
        return getMicrophoneProblem(error);
      }

      try {
        const active = createRecording({
          level: listenSafely(take.context, stream),
          onStopped: (recording) => {
            if (takeRef.current !== take) {
              return;
            }

            const micStartupMs = getStartupMs(take);
            release();
            setStatus("idle");
            onRecorded(micStartupMs === undefined ? recording : { ...recording, micStartupMs });
          },
          stream,
        });

        take.active = active;
        active.recorder.start();
        return (await active.live.promise) ? "recording" : "unavailable";
      } catch {
        if (take.active) {
          finishRecording(take.active);
        } else {
          stopTracks(stream);
        }

        return "unavailable";
      }
    },
    [onRecorded, release],
  );

  const stop = useCallback(() => {
    const active = takeRef.current?.active;

    if (active) {
      finishRecording(active);
    }
  }, []);

  const start = useCallback(async (): Promise<StartResult> => {
    if (takeRef.current) {
      return null;
    }

    if (!canRecord()) {
      setStatus("denied");
      return "unavailable";
    }

    // Made in the tap, or Safari on iOS keeps the meter silent.
    const take: Take = { context: openContext(), pressedAt: performance.now() };
    takeRef.current = take;
    setStatus("acquiring");
    const result = await open(take);

    if (takeRef.current !== take) {
      return null;
    }

    if (result === "recording") {
      setElapsedMs(0);
      setStatus("recording");
    } else {
      release();
      setStatus("denied");
    }

    return result;
  }, [open, release]);

  const readLevel = useCallback(() => takeRef.current?.active?.level?.read() ?? 0, []);

  useEffect(() => {
    if (status !== "recording") {
      return;
    }

    const interval = globalThis.setInterval(() => {
      setElapsedMs(Date.now() - (takeRef.current?.active?.startedAt ?? Date.now()));
    }, TICK_MS);

    return () => globalThis.clearInterval(interval);
  }, [status]);

  useEffect(
    () => () => {
      release();
      setStatus("idle");
      setElapsedMs(0);
    },
    [release],
  );

  return { elapsedMs, readLevel, start, status, stop };
}

"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsMounted } from "./use-is-mounted";

/** A spoken answer is one sentence; a longer recording is a microphone left on. */
const MAX_RECORDING_MS = 30_000;
const TICK_MS = 250;

/** Formats the grader accepts. */
const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

type RecorderStatus = "acquiring" | "denied" | "idle" | "recording";

type Recording = { audio: Blob; durationMs: number };

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

type ActiveRecording = {
  ready: ReturnType<typeof Promise.withResolvers<boolean>>;
  recorder: MediaRecorder;
  released: boolean;
  startedAt: number | null;
  stream: MediaStream;
  timeout: ReturnType<typeof setTimeout>;
};

function finishRecording(active: ActiveRecording) {
  if (active.released) {
    return;
  }

  active.released = true;
  active.ready.resolve(false);
  globalThis.clearTimeout(active.timeout);

  if (active.recorder.state !== "inactive") {
    active.recorder.stop();
  }

  stopTracks(active.stream);
}

function createRecording({
  onStopped,
  stream,
}: {
  onStopped: (recording: Recording) => void;
  stream: MediaStream;
}): ActiveRecording {
  const chunks: Blob[] = [];
  const type = getRecordingType();
  const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);

  const active: ActiveRecording = {
    ready: Promise.withResolvers<boolean>(),
    recorder,
    released: false,
    startedAt: null,
    stream,
    timeout: globalThis.setTimeout(() => finishRecording(active), MAX_RECORDING_MS),
  };

  recorder.addEventListener("start", () => {
    if (!active.released) {
      active.startedAt = Date.now();
      active.ready.resolve(true);
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

type Take = { active?: ActiveRecording; confirmed: boolean; opening?: Promise<StartResult> };

export function useVoiceRecorder({ onRecorded }: { onRecorded: (recording: Recording) => void }) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const takeRef = useRef<Take | null>(null);
  const permissionRef = useRef<PermissionStatus | null>(null);

  useEffect(() => {
    if (navigator.permissions) {
      void safeAsync(() => navigator.permissions.query({ name: "microphone" })).then(({ data }) => {
        permissionRef.current = data;
      });
    }
  }, []);

  const release = useCallback(() => {
    const active = takeRef.current?.active;
    takeRef.current = null;

    if (active) {
      finishRecording(active);
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
          onStopped: (recording) => {
            if (takeRef.current !== take) {
              return;
            }

            takeRef.current = null;
            setStatus("idle");

            if (take.confirmed) {
              onRecorded(recording);
            }
          },
          stream,
        });

        take.active = active;
        active.recorder.start();
        return (await active.ready.promise) ? "recording" : "unavailable";
      } catch {
        if (take.active) {
          finishRecording(take.active);
        } else {
          stopTracks(stream);
        }

        return "unavailable";
      }
    },
    [onRecorded],
  );

  const prepare = useCallback(() => {
    // A cancelled press must never show a permission prompt.
    if (takeRef.current || permissionRef.current?.state !== "granted") {
      return;
    }

    const take: Take = { confirmed: false };
    takeRef.current = take;
    take.opening = open(take);
  }, [open]);

  const cancelPreparation = useCallback(() => {
    if (!takeRef.current?.confirmed) {
      release();
    }
  }, [release]);

  const stop = useCallback(() => {
    const active = takeRef.current?.active;

    if (active) {
      finishRecording(active);
    }
  }, []);

  const start = useCallback(async (): Promise<StartResult> => {
    if (takeRef.current?.confirmed) {
      return null;
    }

    if (!canRecord()) {
      setStatus("denied");
      return "unavailable";
    }

    takeRef.current ??= { confirmed: false };
    takeRef.current.confirmed = true;
    const take = takeRef.current;
    setStatus("acquiring");
    const result = await (take.opening ?? open(take));

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

  return { cancelPreparation, elapsedMs, prepare, start, status, stop };
}

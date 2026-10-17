"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useCallback, useEffect, useRef, useState } from "react";
import { useIsMounted } from "./use-is-mounted";

/** A spoken answer is one sentence; a longer recording is a microphone left on. */
const MAX_RECORDING_MS = 30_000;
const TICK_MS = 250;

/** Formats the grader accepts, in the order browsers support them (Chrome, then Safari). */
const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

type RecorderStatus = "acquiring" | "denied" | "idle" | "recording";

type Recording = { audio: Blob; durationMs: number };

function canRecord(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof globalThis.navigator?.mediaDevices?.getUserMedia === "function"
  );
}

/** Whether this browser can record audio. False while rendering on the server. */
export function useCanRecord(): boolean {
  return useIsMounted() && canRecord();
}

function getRecordingType(): string | undefined {
  return RECORDING_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

type ActiveRecording = {
  recorder: MediaRecorder;
  released: boolean;
  startedAt: number;
  stream: MediaStream;
  timeout: ReturnType<typeof setTimeout>;
};

/** Release the session's own resources before the asynchronous stop event arrives. */
function finishRecording(active: ActiveRecording) {
  if (active.released) {
    return;
  }

  active.released = true;
  globalThis.clearTimeout(active.timeout);

  if (active.recorder.state !== "inactive") {
    active.recorder.stop();
  }

  active.stream.getTracks().forEach((track) => track.stop());
}

/** Constructor/start failures still release the microphone, even before a session is ready. */
async function createRecording({
  onStopped,
  stream,
}: {
  onStopped: (recording: Recording) => void;
  stream: MediaStream;
}): Promise<ActiveRecording | null> {
  const session: { active: ActiveRecording | null; started: boolean } = {
    active: null,
    started: false,
  };

  const { data: active } = await safeAsync(async () => {
    const chunks: Blob[] = [];
    const type = getRecordingType();
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);

    const recording: ActiveRecording = {
      recorder,
      released: false,
      startedAt: Date.now(),
      stream,
      timeout: globalThis.setTimeout(() => finishRecording(recording), MAX_RECORDING_MS),
    };

    session.active = recording;
    recorder.addEventListener("dataavailable", (event) => chunks.push(event.data));

    recorder.addEventListener("stop", () => {
      finishRecording(recording);

      if (session.started) {
        onStopped({
          audio: new Blob(chunks, { type: recorder.mimeType }),
          durationMs: Date.now() - recording.startedAt,
        });
      }
    });

    recorder.start();
    session.started = true;
    return recording;
  });

  if (!active) {
    if (session.active) {
      finishRecording(session.active);
    } else {
      stream.getTracks().forEach((track) => track.stop());
    }
  }

  return active;
}

/**
 * Records one spoken answer in the browser. Audio stays in memory and goes only to the grader;
 * the microphone turns off as soon as recording stops. Recording stops by itself after 30 seconds.
 */
export function useVoiceRecorder({ onRecorded }: { onRecorded: (recording: Recording) => void }) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const activeRef = useRef<ActiveRecording | null>(null);
  const acquisitionRef = useRef<symbol | null>(null);
  const unmountedRef = useRef(false);

  const stop = useCallback(() => {
    const active = activeRef.current;

    if (active) {
      finishRecording(active);
    }
  }, []);

  /** False means blocked; null means a busy or departed owner has no new recording to start. */
  const start = useCallback(async (): Promise<boolean | null> => {
    if (acquisitionRef.current || unmountedRef.current) {
      return null;
    }

    if (!canRecord()) {
      setStatus("denied");
      return false;
    }

    const acquisition = Symbol("voice-recording");
    acquisitionRef.current = acquisition;
    setStatus("acquiring");

    const { data: stream } = await safeAsync(() =>
      navigator.mediaDevices.getUserMedia({ audio: true }),
    );

    if (unmountedRef.current || acquisitionRef.current !== acquisition) {
      stream?.getTracks().forEach((track) => track.stop());
      return null;
    }

    if (!stream) {
      acquisitionRef.current = null;
      setStatus("denied");
      return false;
    }

    const active = await createRecording({
      onStopped: (recording) => {
        if (unmountedRef.current || acquisitionRef.current !== acquisition) {
          return;
        }

        activeRef.current = null;
        acquisitionRef.current = null;
        setStatus("idle");
        onRecorded(recording);
      },
      stream,
    });

    if (unmountedRef.current || acquisitionRef.current !== acquisition) {
      if (active) {
        finishRecording(active);
      }

      return null;
    }

    if (!active) {
      acquisitionRef.current = null;
      setStatus("denied");
      return false;
    }

    activeRef.current = active;

    setElapsedMs(0);
    setStatus("recording");
    return true;
  }, [onRecorded]);

  useEffect(() => {
    if (status !== "recording") {
      return;
    }

    const interval = globalThis.setInterval(() => {
      setElapsedMs(Date.now() - (activeRef.current?.startedAt ?? Date.now()));
    }, TICK_MS);

    return () => globalThis.clearInterval(interval);
  }, [status]);

  useEffect(() => {
    unmountedRef.current = false;

    return () => {
      unmountedRef.current = true;
      acquisitionRef.current = null;
      const active = activeRef.current;
      activeRef.current = null;
      setStatus("idle");
      setElapsedMs(0);

      if (active) {
        finishRecording(active);
      }
    };
  }, []);

  return { elapsedMs, start, status, stop };
}

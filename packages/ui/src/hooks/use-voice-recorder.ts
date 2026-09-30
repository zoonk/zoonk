"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIsMounted } from "./use-is-mounted";

/** A spoken answer is one sentence; a longer recording is a microphone left on. */
const MAX_RECORDING_MS = 30_000;
const TICK_MS = 250;

/** Formats the grader accepts, in the order browsers support them (Chrome, then Safari). */
const RECORDING_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

type RecorderStatus = "denied" | "idle" | "recording";

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
  startedAt: number;
  stream: MediaStream;
  timeout: ReturnType<typeof setTimeout>;
};

/**
 * Records one spoken answer in the browser. Audio stays in memory and goes only to the grader;
 * the microphone turns off as soon as recording stops. Recording stops by itself after 30 seconds.
 */
export function useVoiceRecorder({ onRecorded }: { onRecorded: (recording: Recording) => void }) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const activeRef = useRef<ActiveRecording | null>(null);
  const unmountedRef = useRef(false);

  const stop = useCallback(() => {
    const active = activeRef.current;

    if (active?.recorder.state === "recording") {
      active.recorder.stop();
    }
  }, []);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);

    if (!stream) {
      setStatus("denied");
      return;
    }

    const chunks: Blob[] = [];
    const type = getRecordingType();
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const startedAt = Date.now();

    recorder.addEventListener("dataavailable", (event) => chunks.push(event.data));

    recorder.addEventListener("stop", () => {
      const active = activeRef.current;
      activeRef.current = null;
      stream.getTracks().forEach((track) => track.stop());
      globalThis.clearTimeout(active?.timeout);

      if (unmountedRef.current) {
        return;
      }

      setStatus("idle");

      onRecorded({
        audio: new Blob(chunks, { type: recorder.mimeType }),
        durationMs: Date.now() - startedAt,
      });
    });

    activeRef.current = {
      recorder,
      startedAt,
      stream,
      timeout: globalThis.setTimeout(stop, MAX_RECORDING_MS),
    };

    recorder.start();
    setElapsedMs(0);
    setStatus("recording");
  }, [onRecorded, stop]);

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
      activeRef.current?.stream.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return { elapsedMs, start, status, stop };
}

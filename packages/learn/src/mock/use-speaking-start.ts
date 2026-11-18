"use client";

import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { useState } from "react";
import { type ContentWriting } from "../generation/writing-wait";
import { type MockActions, type MockStep } from "./mock-context";

/**
 * The speaking part's Start stays in the bar: off while its paper is written, which opens on its
 * own, and on again when opening it failed, so the failure has something to try again.
 */
export function canStartSpeaking({
  error,
  pending,
  writing,
}: {
  error: boolean;
  pending: boolean;
  writing: boolean;
}): boolean {
  return !pending && (!writing || error);
}

/** A paper still unwritten after its run ended would loop, so asking again then fails. */
export function useSpeakingStart({
  start,
  step,
}: {
  start: MockActions["startSpeaking"];
  step: (kind: MockStep, request: () => Promise<MockView | "writing" | null>) => Promise<void>;
}) {
  const [run, setRun] = useState<string | null>(null);

  const startSpeaking = (afterWrite: boolean) =>
    step("startSpeaking", async () => {
      const started = await start();

      if (started && "generationId" in started) {
        setRun(afterWrite ? null : started.generationId);
        return afterWrite ? null : "writing";
      }

      setRun(null);
      return started;
    });

  const speakingWriting: ContentWriting | null = run
    ? {
        generationId: run,
        onReady: () => void startSpeaking(true),
        restart: () => startSpeaking(false),
      }
    : null;

  return { speakingWriting, startSpeaking: () => startSpeaking(false) };
}

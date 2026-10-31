"use client";

import { type MockView } from "@zoonk/core/exams/mocks/contract";
import { useState } from "react";
import { type ContentWriting } from "../generation/writing-wait";
import { type MockActions, type MockStep } from "./mock-context";

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

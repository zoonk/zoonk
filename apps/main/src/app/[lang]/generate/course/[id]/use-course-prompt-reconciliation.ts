"use client";

import { type GenerationErrorKind, type GenerationStatus } from "@/lib/workflow/generation-store";
import { getString } from "@zoonk/utils/json";
import { API_URL } from "@zoonk/utils/url";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { readCoursePromptGeneration } from "./read-course-prompt-generation";

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 120;
const MAX_READ_FAILURES = 5;

type PromptGeneration = Awaited<ReturnType<typeof readCoursePromptGeneration>>;
type ReadyTarget = Extract<PromptGeneration, { status: "redirect" }>["target"];

/** A terminal run can have handed ownership to another run before that winner failed. */
async function readTerminalGenerationId({ runId, signal }: { runId: string; signal: AbortSignal }) {
  const response = await fetch(`${API_URL}/v1/generations/${encodeURIComponent(runId)}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error("Could not read generation status");
  }

  const data: unknown = await response.json();
  const status = getString(data, "status");

  if (
    getString(data, "id") !== runId ||
    !["pending", "running", "completed", "failed", "cancelled"].includes(status ?? "")
  ) {
    throw new Error("Invalid generation status");
  }

  return status === "pending" || status === "running" ? null : runId;
}

/**
 * Identity search can join an existing workflow after the browser starts
 * listening to a new run. The durable prompt owns both the winning run and the
 * real course/lesson destination, so reconcile it alongside streaming progress.
 */
export function useCoursePromptReconciliation({
  onResume,
  requestId,
  runId,
  status,
}: {
  onResume: (generationRunId: string) => void;
  requestId: string;
  runId: string | null;
  status: GenerationStatus;
}) {
  const [target, setTarget] = useState<ReadyTarget | null>(null);
  const [errorKind, setErrorKind] = useState<GenerationErrorKind | null>(null);
  const hasError = errorKind !== null;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = status !== "completed" && status !== "limitReached" && !target && !hasError;

  const readLatestGeneration = useEffectEvent(
    async (result: PromptGeneration, signal: AbortSignal) => {
      if (result.status !== "pending" || result.generationStatus !== "failed" || !runId) {
        return { generation: result, terminalRunId: null };
      }

      const terminalRunId = await readTerminalGenerationId({ runId, signal });

      if (!terminalRunId || signal.aborted) {
        return { generation: result, terminalRunId: null };
      }

      // The initial failed snapshot can predate a retry's completion. Read
      // readiness again after the followed run is known to have finished.
      const generation = await readCoursePromptGeneration(requestId);
      return { generation, terminalRunId };
    },
  );

  const reconcile = useEffectEvent((result: PromptGeneration, terminalRunId: string | null) => {
    if (result.status === "redirect") {
      setTarget(result.target);
      return;
    }

    if (result.status === "notFound") {
      setErrorKind("connection");
      return;
    }

    /**
     * A retry can still be resolving identity while the prompt retains its old
     * failed state. Stop only after that retry has finished and the prompt still
     * reports failure, including a joined winner that failed before polling.
     */
    if (terminalRunId && terminalRunId === runId && result.generationStatus === "failed") {
      setErrorKind("generation");
      return;
    }

    if (
      result.generationStatus === "running" &&
      result.generationRunId &&
      result.generationRunId !== runId
    ) {
      onResume(result.generationRunId);
    }
  });

  useEffect(() => {
    if (!active) {
      return;
    }

    const controller = new AbortController();

    async function poll(attempt: number, failures: number): Promise<void> {
      try {
        const result = await readCoursePromptGeneration(requestId);

        if (controller.signal.aborted) {
          return;
        }

        const { generation, terminalRunId } = await readLatestGeneration(result, controller.signal);

        if (controller.signal.aborted) {
          return;
        }

        reconcile(generation, terminalRunId);

        if (generation.status !== "pending") {
          return;
        }

        if (attempt >= MAX_POLL_ATTEMPTS) {
          setErrorKind("connection");
          return;
        }

        timer.current = setTimeout(() => void poll(attempt + 1, 0), POLL_INTERVAL_MS);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        if (failures + 1 >= MAX_READ_FAILURES || attempt >= MAX_POLL_ATTEMPTS) {
          setErrorKind("connection");
          return;
        }

        timer.current = setTimeout(() => void poll(attempt + 1, failures + 1), POLL_INTERVAL_MS);
      }
    }

    timer.current = setTimeout(() => void poll(1, 0), POLL_INTERVAL_MS);

    return () => {
      controller.abort();

      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [active, requestId]);

  return { errorKind, hasError, target };
}

"use client";

import { safeParseStepContent } from "@zoonk/core/library/steps/contract";
import { settleWithin } from "@zoonk/utils/timeout";
import { useCallback, useState } from "react";
import { useLessonPlayerConfig } from "../lesson-player-context";
import {
  type HelpLimitOutcome,
  type StepVariantKind,
  type StepVariantOutcome,
} from "../lesson-player-types";
import { type StepOf } from "../steps/lesson-step-view-props";

export type DepthStep = StepOf<"explanation"> | StepOf<"workedExample">;

type DepthContent = DepthStep["content"];

/**
 * A new version takes 3 to 8 seconds on real runs (Luna, one call): past `slowMs` the sheet says
 * it's still writing, and past `timeoutMs` it stops waiting and offers to try again.
 */
export const VARIANT_BOUNDS = { slowMs: 12_000, timeoutMs: 30_000 } as const;

export type VariantState =
  | { content: DepthContent; id: string; status: "ready" }
  | HelpLimitOutcome
  | { retryAfterSeconds: number; status: "slowDown" }
  | { status: "failed" }
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unsupported" };

function toVariantState({
  outcome,
  step,
}: {
  outcome: StepVariantOutcome;
  step: DepthStep;
}): VariantState {
  if (
    outcome.status === "limitReached" ||
    outcome.status === "slowDown" ||
    outcome.status === "unsupported"
  ) {
    return outcome;
  }

  if (outcome.status !== "ready") {
    return { status: "failed" };
  }

  const parsed = safeParseStepContent(step.kind, outcome.content);

  return parsed.success
    ? { content: parsed.data, id: outcome.id, status: "ready" }
    : { status: "failed" };
}

/**
 * Whether the learner asked with the button, took the offer made when they struggled, or the
 * lesson opened the deeper version by default.
 */
export type VariantTrigger = "button" | "default" | "struggle";

/**
 * A "Simpler" or "Go deeper" version of a screen: the shared one when it exists, otherwise made
 * on request, which takes a few seconds the first time anyone asks.
 */
export function useStepVariant(step: DepthStep) {
  const { adapters, track } = useLessonPlayerConfig();
  const [states, setStates] = useState<Partial<Record<StepVariantKind, VariantState>>>({});

  const getState = useCallback(
    (kind: StepVariantKind): VariantState => {
      const stored = step.variants[kind];

      return stored
        ? { content: stored.content, id: stored.id, status: "ready" }
        : (states[kind] ?? { status: "idle" });
    },
    [states, step.variants],
  );

  const request = useCallback(
    async (kind: StepVariantKind, trigger: VariantTrigger = "button") => {
      track({ name: "Depth Requested", properties: { depth: kind, step_id: step.id, trigger } });

      const { requestVariant } = adapters;
      const status = states[kind]?.status;

      if (step.variants[kind] || !requestVariant || status === "ready" || status === "loading") {
        return;
      }

      setStates((current) => ({ ...current, [kind]: { status: "loading" } }));

      const settled = await settleWithin({
        ms: VARIANT_BOUNDS.timeoutMs,
        request: () => requestVariant({ kind, stepId: step.id }),
      }).catch(() => null);

      const next: VariantState =
        settled?.status === "settled"
          ? toVariantState({ outcome: settled.value, step })
          : { status: "failed" };

      setStates((current) => ({ ...current, [kind]: next }));
    },
    [adapters, states, step, track],
  );

  /** A screen the writer can't make a version of says so once; its button then goes away. */
  const isAvailable = useCallback(
    (kind: StepVariantKind) =>
      Boolean(
        step.variants[kind] || (adapters.requestVariant && states[kind]?.status !== "unsupported"),
      ),
    [adapters.requestVariant, states, step.variants],
  );

  return { getState, isAvailable, request };
}

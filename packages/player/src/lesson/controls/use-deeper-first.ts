"use client";

import { useEffect, useState } from "react";
import { useLessonPlayerConfig } from "../lesson-player-context";
import { type StepOf } from "../steps/lesson-step-view-props";
import { useStepVariant } from "./use-step-variant";

type ExplanationStep = StepOf<"explanation">;

export type DeeperFirst = {
  /** The deeper version is on screen, or the learner switched back to the original. */
  canSwitch: boolean;
  content: ExplanationStep["content"];
  isDeeper: boolean;
  showsOriginal: boolean;
  toggle: () => void;
};

/**
 * For learners who asked for a more technical register (in settings, or memory noticed), an
 * explanation opens its shared "Go deeper" version instead of the base screen, so nothing new is
 * written for them. The base screen shows until that version is ready, and one tap goes back to it.
 */
export function useDeeperFirst(step: ExplanationStep): DeeperFirst {
  const { deeperByDefault } = useLessonPlayerConfig();
  const variant = useStepVariant(step);
  const [showsOriginal, setShowsOriginal] = useState(false);
  const wanted = deeperByDefault && variant.isAvailable("deeper");
  const state = variant.getState("deeper");
  const { request } = variant;

  useEffect(() => {
    if (wanted && state.status === "idle") {
      void request("deeper", "default");
    }
  }, [request, state.status, wanted]);

  const ready = wanted && state.status === "ready" && "text" in state.content;
  const deeper = ready && !showsOriginal ? state.content : null;

  return {
    canSwitch: ready,
    content: deeper && "text" in deeper ? { ...step.content, ...deeper } : step.content,
    isDeeper: deeper !== null,
    showsOriginal,
    toggle: () => setShowsOriginal((current) => !current),
  };
}

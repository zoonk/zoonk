"use client";

import { useEffect, useRef } from "react";

type StepTransitionRef = { index: number; isStatic: boolean };

function getTransitionClass(
  prev: StepTransitionRef | null,
  stepIndex: number,
  isStatic: boolean,
): string {
  if (!prev) {
    return "";
  }

  if (prev.isStatic !== isStatic) {
    return "animate-in fade-in duration-200";
  }

  return stepIndex > prev.index
    ? "animate-in slide-in-from-right-4 duration-300"
    : "animate-in slide-in-from-left-4 duration-300";
}

export function useStepTransition(stepIndex: number, isStatic: boolean): string {
  const prevRef = useRef<StepTransitionRef | null>(null);
  const transitionClass = getTransitionClass(prevRef.current, stepIndex, isStatic);

  useEffect(() => {
    prevRef.current = { index: stepIndex, isStatic };
  });

  return transitionClass;
}

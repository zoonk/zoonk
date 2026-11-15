"use client";

import { createContext, use, useLayoutEffect } from "react";

/** Set by `ActivityStep`: whether the canvas is still asking its own question. */
export const CanvasQuestionContext = createContext<((isAsking: boolean) => void) | null>(null);

/**
 * A canvas that asks something of its own before the step's question (fill the square, then say
 * the share) holds that question back while it's asking, so the screen asks one thing at a time.
 */
export function useCanvasQuestion(isAsking: boolean) {
  const setAsking = use(CanvasQuestionContext);

  useLayoutEffect(() => {
    setAsking?.(isAsking);
    return () => setAsking?.(false);
  }, [isAsking, setAsking]);
}

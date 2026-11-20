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

/** Set by `ActivityStep`: whether the canvas is taking the number keys from the step's question. */
export const CanvasKeysContext = createContext<((hasKeys: boolean) => void) | null>(null);

/** While the canvas picks with the number keys (a square being changed), the step's question stops answering them and hides their badges. */
export function useCanvasNumberKeys(hasKeys: boolean) {
  const setHasKeys = use(CanvasKeysContext);

  useLayoutEffect(() => {
    setHasKeys?.(hasKeys);
    return () => setHasKeys?.(false);
  }, [hasKeys, setHasKeys]);
}

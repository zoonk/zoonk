"use client";

import { useEffect, useRef } from "react";

/**
 * An on-screen keyboard would cover the verdict, so it closes as the answer is sent. A physical one
 * stays in the field, so a check that fails leaves the answer ready to edit, and moves to the button
 * Enter presses once the verdict shows.
 */
export function useAnswerFocus(result: "correct" | "wrong" | null) {
  const fieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (result && document.activeElement === fieldRef.current) {
      document.querySelector<HTMLElement>("[aria-keyshortcuts~='Enter']")?.focus();
    }
  }, [result]);

  const answerSent = () => {
    if (!globalThis.matchMedia("(pointer: fine)").matches) {
      fieldRef.current?.blur();
    }
  };

  return { answerSent, fieldRef };
}

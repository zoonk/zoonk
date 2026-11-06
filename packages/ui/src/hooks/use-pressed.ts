"use client";

import { useState } from "react";

/**
 * For buttons that share one pending action, such as an answer's choices: only the one pressed is
 * `busy`, while the others wait disabled.
 */
export function usePressed<Choice>(pending: boolean) {
  const [pressed, setPressed] = useState<Choice | null>(null);

  return {
    busy: (choice: Choice) => pending && pressed === choice,
    press: (choice: Choice) => setPressed(() => choice),
  };
}

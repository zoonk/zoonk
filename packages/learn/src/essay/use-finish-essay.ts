"use client";

import { useState } from "react";
import { useEssayScreen } from "./essay-context";

/** Finishing a written task's block: one try at a time, with how many failed in a row. */
export function useFinishTask(finishTask: () => Promise<boolean>) {
  const [pending, setPending] = useState(false);
  const [failures, setFailures] = useState(0);

  async function finish() {
    setPending(true);
    const finished = await finishTask().catch(() => false);
    setPending(false);
    setFailures((count) => (finished ? 0 : count + 1));
  }

  return { failures, finish, pending };
}

export function useFinishEssay() {
  return useFinishTask(useEssayScreen().actions.finish);
}

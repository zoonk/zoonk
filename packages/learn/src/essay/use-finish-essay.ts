"use client";

import { useState } from "react";
import { useEssayScreen } from "./essay-context";

export function useFinishEssay() {
  const { actions } = useEssayScreen();
  const [pending, setPending] = useState(false);
  const [failures, setFailures] = useState(0);

  async function finish() {
    setPending(true);
    const finished = await actions.finish().catch(() => false);
    setPending(false);
    setFailures((count) => (finished ? 0 : count + 1));
  }

  return { failures, finish, pending };
}

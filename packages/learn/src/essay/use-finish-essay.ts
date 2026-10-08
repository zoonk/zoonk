"use client";

import { useState } from "react";
import { useEssayScreen } from "./essay-context";

/** Finishes the writing block and goes on with the session, saying so when it didn't go through. */
export function useFinishEssay() {
  const { actions } = useEssayScreen();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function finish() {
    setPending(true);
    const finished = await actions.finish().catch(() => false);
    setPending(false);
    setFailed(!finished);
  }

  return { failed, finish, pending };
}

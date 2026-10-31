"use client";

import { useState } from "react";
import { useEssayScreen } from "./essay-context";

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

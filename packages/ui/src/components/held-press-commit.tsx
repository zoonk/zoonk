"use client";

import { useEffect } from "react";

/**
 * In the root layout, beside `HELD_PRESS_SCRIPT` in the head: its effect runs once the root has
 * committed, which is when the script starts handing held presses to the controls React owns.
 */
export function HeldPressCommit() {
  useEffect(() => {
    globalThis.zoonkHeldPresses?.commit();
  }, []);

  return null;
}

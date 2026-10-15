import { useEffectEvent, useId, useLayoutEffect, useState } from "react";
import { KEEP_TYPING_ATTRIBUTE } from "./kept-typing-script";

/**
 * Keeps what a learner typed into a field before its code arrived (a slow device; the page's
 * inline keeper, `KEEP_TYPING_SCRIPT`, records it). `typed` is what the field holds as React first
 * draws it (an uncontrolled field's `defaultValue` starts from it, so hydration doesn't put the
 * field back to the words it came with); `onAdopt` gets the last words typed until the field's
 * code took over, before the next paint, and the keeper stops recording the field. Spread `field`
 * on the input or textarea.
 */
export function useKeptTyping(onAdopt: (typed: string) => void) {
  const key = useId();
  const adopt = useEffectEvent(onAdopt);
  // oxlint-disable-next-line react/hook-use-state -- Read once as the field is first drawn, never updated.
  const [typed] = useState(() => globalThis.zoonkKeptTyping?.typed.get(key));

  useLayoutEffect(() => {
    const kept = globalThis.zoonkKeptTyping;

    if (!kept) {
      return;
    }

    const last = kept.typed.get(key);
    kept.typed.delete(key);
    kept.taken.add(key);

    if (last !== undefined) {
      adopt(last);
    }
  }, [key]);

  return { field: { [KEEP_TYPING_ATTRIBUTE]: key }, typed };
}

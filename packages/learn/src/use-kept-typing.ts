import { useEffectEvent, useId, useLayoutEffect, useState } from "react";
import { KEEP_TYPING_ATTRIBUTE } from "./kept-typing-script";

/**
 * Spread `field` on the input and start its `defaultValue` from `typed`; `onAdopt` gets the words
 * typed before the field's code took over.
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

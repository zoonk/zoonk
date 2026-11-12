"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

/** State that starts from what the server sent and starts over whenever it sends something new. */
export function useServedState<Value>(served: Value) {
  const [state, setState] = useState(served);
  const [previous, setPrevious] = useState(served);

  if (served !== previous) {
    setPrevious(served);
    setState(served);
  }

  return [state, setState] as const;
}

/**
 * Calls `reread` once for each copy the server sends after the first: the router can hand back a
 * copy older than what the screen shows, such as one it kept from before the learner's taps.
 */
export function useRereadServed<Value>(served: Value, reread: () => void) {
  const onCopy = useEffectEvent(reread);
  const handled = useRef(served);

  useEffect(() => {
    if (served !== handled.current) {
      handled.current = served;
      onCopy();
    }
  }, [served]);
}

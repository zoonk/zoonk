"use client";

import { useState } from "react";

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

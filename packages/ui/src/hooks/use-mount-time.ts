import { useState } from "react";

/**
 * The time a component first rendered, fixed for its lifetime. Reading the clock in render would
 * give every re-render a different answer; a lazy initial state reads it once.
 */
export function useMountTime(): Date {
  // oxlint-disable-next-line react/hook-use-state -- Read once and never updated, so there is no setter.
  const [mountedAt] = useState(() => new Date());
  return mountedAt;
}

import { useState } from "react";

export function useMountTime(): Date {
  // oxlint-disable-next-line react/hook-use-state -- Read once and never updated, so there is no setter.
  const [mountedAt] = useState(() => new Date());
  return mountedAt;
}

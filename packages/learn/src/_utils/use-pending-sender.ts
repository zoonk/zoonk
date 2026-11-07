import { useState } from "react";

/**
 * Which control sent the pending request, set by the handler that starts it, so only that control
 * spins and the others wait. Null once it settles, or while a request something else started runs.
 */
export function usePendingSender<Sender extends string>(pending: boolean) {
  const [sender, setSender] = useState<Sender | null>(null);

  if (!pending && sender !== null) {
    setSender(null);
  }

  return [pending ? sender : null, setSender] as const;
}

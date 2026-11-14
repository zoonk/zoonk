import { useEffect, useRef } from "react";

/**
 * Read after an await: whether the piece of screen that asked (a sheet, a card) is still there.
 * Closing a sheet is no navigation, so the host's "still here" check can't see it.
 */
export function useStillMounted(): () => boolean {
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  return () => mounted.current;
}

import { useLayoutEffect, useRef } from "react";

/**
 * Next.js keeps a route's state with React Activity: https://github.com/vercel/next.js/issues/86577.
 * With `open`, it unhides only on a real close-to-open change, so stale state doesn't flash on back.
 */
export function useHideElement<Element extends HTMLElement>(open?: boolean) {
  const ref = useRef<Element | null>(null);
  const prevOpen = useRef(open);

  useLayoutEffect(
    () => () => {
      ref.current?.classList.add("hidden");
    },
    [],
  );

  useLayoutEffect(() => {
    if (open && !prevOpen.current) {
      ref.current?.classList.remove("hidden");
    }

    prevOpen.current = open;
  }, [open]);

  return ref;
}

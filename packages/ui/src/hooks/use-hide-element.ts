import { useLayoutEffect, useRef } from "react";

/**
 * Hides an element on unmount.
 *
 * This is a workaround for next.js route caching, which uses React Activity to preserve a route's state:
 * https://github.com/vercel/next.js/issues/86577
 *
 * When `open` is provided, hidden is only removed on genuine close-to-open transitions,
 * preventing stale Activity state from flashing the element on back-navigation.
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

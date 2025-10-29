import { useLayoutEffect, useRef } from "react";

/**
 * This is a workaround for this issue:
 * https://github.com/facebook/react/issues/35000
 *
 * On Next.js 16, they're using `Activity` to cache routes.
 * However, `Activity` doesn't hide portals, making them visible on the new route.
 *
 * See these links for more context:
 *
 * - https://github.com/vercel/next.js/issues/85390
 * - https://github.com/vercel/next.js/pull/84923
 *
 * We can remove this hook once this is fixed on React or Next.js adds a separate
 * flag for routing caching. Right now, we can't disable it without also disabling
 * `cacheComponents`.
 */
export function useRemovePortal() {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(
    () => () => {
      if (ref.current) {
        ref.current.style.display = "none";
      }
    },
    [],
  );

  return ref;
}

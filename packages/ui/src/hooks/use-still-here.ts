import { useEffect, useRef } from "react";

/** Read after an await: whether the component that started the work is still on screen. */
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

function currentPage(): string {
  return globalThis.location.pathname + globalThis.location.search;
}

/**
 * Call as the work starts. The check it returns says whether the learner is still on that page, so
 * a late answer never takes them somewhere after they went elsewhere.
 */
export function useStillOnPage(): () => () => boolean {
  const isMounted = useStillMounted();

  return () => {
    const startedOn = currentPage();
    return () => isMounted() && currentPage() === startedOn;
  };
}

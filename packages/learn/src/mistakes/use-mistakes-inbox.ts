"use client";

import { useState, useSyncExternalStore } from "react";

/** Tailwind's `lg`. */
const INBOX_QUERY = "(min-width: 64rem)";

function subscribe(callback: () => void) {
  const query = globalThis.matchMedia(INBOX_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/**
 * The notebook's skills: from `lg` a list beside one skill's mistakes, under it folds that open and
 * close on their own, so opening one never moves the row the learner tapped. Both start on the first.
 */
export function useMistakesInbox(keys: readonly string[]) {
  const isInbox = useSyncExternalStore(
    subscribe,
    () => globalThis.matchMedia(INBOX_QUERY).matches,
    () => false,
  );

  const [shown, setShown] = useState<string | null>(keys[0] ?? null);
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set(keys.slice(0, 1)));
  const current = shown !== null && keys.includes(shown) ? shown : (keys[0] ?? null);

  const select = (key: string) => {
    const closes = !isInbox && opened.has(key);

    setShown(key);

    setOpened((open) =>
      closes ? new Set([...open].filter((each) => each !== key)) : new Set([...open, key]),
    );
  };

  return { isShown: (key: string) => (isInbox ? current === key : opened.has(key)), select };
}

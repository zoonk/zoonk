"use client";

import { useExtracted } from "next-intl";

/** The textarea names it in `aria-describedby`, so a screen reader reads the count on focus, not on every word. */
export function EssayWordCount({ id, words }: { id: string; words: number }) {
  const t = useExtracted();

  return (
    <p className="text-muted-foreground min-h-4 font-mono text-xs tabular-nums" id={id}>
      {words > 0 && t("{count, plural, one {# word} other {# words}}", { count: words })}
    </p>
  );
}

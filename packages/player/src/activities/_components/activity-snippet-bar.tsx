"use client";

import { HorizontalScroll } from "@zoonk/ui/components/horizontal-scroll";
import { useExtracted } from "next-intl";
import { useLayoutEffect, useRef } from "react";
import { type CodeSnippet, insertAtCursor } from "../_utils/insert-at-cursor";

export function useInsertSnippet({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const cursorRef = useRef<number | null>(null);

  // React moves the caret when it writes the controlled value; restore it before the next input.
  useLayoutEffect(() => {
    const cursor = cursorRef.current;
    const field = fieldRef.current;

    if (cursor === null || !field) {
      return;
    }

    cursorRef.current = null;
    field.focus();
    field.setSelectionRange(cursor, cursor);
  });

  function insert(snippet: CodeSnippet) {
    const field = fieldRef.current;

    const selection = {
      end: field?.selectionEnd ?? value.length,
      start: field?.selectionStart ?? value.length,
    };

    const next = insertAtCursor({
      selectionEnd: selection.end,
      selectionStart: selection.start,
      snippet,
      value,
    });

    onChange(next.value);

    cursorRef.current = next.cursor;
  }

  return { fieldRef, insert };
}

export function ActivitySnippetBar({
  disabled,
  label,
  onInsert,
  snippets,
}: {
  disabled?: boolean;
  label: string;
  onInsert: (snippet: CodeSnippet) => void;
  snippets: readonly (CodeSnippet & { label: string; name: string })[];
}) {
  const t = useExtracted();

  return (
    <HorizontalScroll
      className="has-[>button]:px-12 [&>button]:size-11 [&>button]:pointer-coarse:inline-flex"
      labels={{ left: t("Scroll left"), right: t("Scroll right") }}
    >
      <div
        aria-label={label}
        className="flex w-max min-w-full gap-2"
        data-slot="activity-snippet-bar"
        role="group"
      >
        {snippets.map((snippet) => (
          <button
            aria-label={
              snippet.name === snippet.label ? undefined : `${snippet.label}, ${snippet.name}`
            }
            className="bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-ring/50 flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg px-3 font-mono text-sm outline-none select-none focus-visible:ring-[3px] focus-visible:ring-inset disabled:opacity-50"
            disabled={disabled}
            key={snippet.label}
            onClick={() => onInsert(snippet)}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            {snippet.label}
          </button>
        ))}
      </div>
    </HorizontalScroll>
  );
}

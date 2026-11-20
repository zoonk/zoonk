"use client";

import { CODE_FIELD_TEXT, CODE_SCROLL_SIGN, CodeLineNumber, CodeTokens } from "@zoonk/learn/code";
import { codeLineText, highlightCode } from "@zoonk/learn/code/highlight";
import { useKeptTyping } from "@zoonk/ui/hooks/kept-typing";
import { cn } from "@zoonk/ui/lib/utils";
import { useLayoutEffect, useRef } from "react";
import { type CodeSnippet, insertAtCursor } from "../_utils/insert-at-cursor";
import { keyedByPosition } from "../_utils/position-keys";
import { ACTIVITY_FIELD_CLASS } from "./activity-canvas";
import { ActivityHorizontalScroll } from "./activity-horizontal-scroll";

const FIELD_RESET =
  "col-start-1 row-start-1 m-0 min-w-0 resize-none overflow-hidden border-0 bg-transparent p-0 whitespace-pre text-transparent caret-foreground outline-none selection:bg-viz-accent-soft placeholder:text-muted-foreground";

export function ActivityCodeLineInput({
  language,
  onChange,
  value,
  ...props
}: Omit<React.ComponentProps<"textarea">, "onChange" | "value"> & {
  language: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const kept = useKeptTyping({ value });

  return (
    <span className="grid min-w-0 flex-1" data-slot="activity-code-line-input">
      <span
        aria-hidden="true"
        className="col-start-1 row-start-1 wrap-anywhere whitespace-pre-wrap"
      >
        <CodeTokens field tokens={highlightCode(value, language)[0] ?? []} />
      </span>

      {/* Reaches a 44 px tap target into the rows around it, so its own row keeps one line height. */}
      <textarea
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className={cn(
          FIELD_RESET,
          "relative z-10 -my-(--target-pad) w-full py-(--target-pad) wrap-anywhere whitespace-pre-wrap [--target-pad:max(0px,calc((44px-1lh)/2))]",
        )}
        onChange={(event) => onChange(event.target.value.replaceAll(/[\r\n]/gu, ""))}
        rows={1}
        spellCheck={false}
        value={value}
        {...props}
        {...kept}
      />
    </span>
  );
}

export function ActivityCodeEditor({
  className,
  editorRef,
  label,
  language,
  onChange,
  onSubmit,
  value,
  ...props
}: Omit<React.ComponentProps<"textarea">, "onChange" | "value"> & {
  editorRef?: React.Ref<HTMLTextAreaElement>;
  label: string;
  language: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  value: string;
}) {
  const lines = value.split("\n");
  const kept = useKeptTyping({ value });

  return (
    <div className={cn(ACTIVITY_FIELD_CLASS, className)} data-slot="activity-code-editor">
      <ActivityHorizontalScroll box={{ label }} className={CODE_SCROLL_SIGN}>
        <div
          className={cn(
            "grid w-full grid-cols-[max-content_minmax(0,1fr)] px-3 py-3",
            CODE_FIELD_TEXT,
          )}
          style={{ gridTemplateRows: `repeat(${lines.length}, auto)` }}
        >
          {keyedByPosition(highlightCode(value, language), codeLineText).map(
            ({ item, key }, index) => (
              <div aria-hidden="true" className="contents" key={key}>
                <CodeLineNumber number={index + 1} style={{ gridRow: index + 1 }} />

                <div
                  className="col-start-2 wrap-anywhere whitespace-pre-wrap"
                  style={{ gridRow: index + 1 }}
                >
                  <CodeTokens field tokens={item} />
                </div>
              </div>
            ),
          )}

          <textarea
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className={cn(
              FIELD_RESET,
              "relative col-start-2 row-span-full -my-3 min-h-lh w-full py-3 wrap-anywhere whitespace-pre-wrap [font:inherit]",
            )}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (onSubmit && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                onSubmit();
              }
            }}
            ref={editorRef}
            rows={lines.length}
            spellCheck={false}
            value={value}
            wrap="soft"
            {...props}
            {...kept}
          />
        </div>
      </ActivityHorizontalScroll>
    </div>
  );
}

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
  return (
    <ActivityHorizontalScroll
      box={{ label }}
      className={cn(CODE_SCROLL_SIGN, "has-[>button]:px-12 [&>button]:size-11")}
    >
      <div className="flex w-max min-w-full gap-2" data-slot="activity-snippet-bar">
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
    </ActivityHorizontalScroll>
  );
}

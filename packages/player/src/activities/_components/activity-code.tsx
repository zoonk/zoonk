"use client";

import { useKeptTyping } from "@zoonk/ui/hooks/kept-typing";
import { cn } from "@zoonk/ui/lib/utils";
import { useLayoutEffect, useRef } from "react";
import {
  type CodeLanguage,
  type CodeToken,
  type CodeTokenKind,
  highlightCode,
} from "../_utils/highlight-code";
import { type CodeSnippet, insertAtCursor } from "../_utils/insert-at-cursor";
import { keyedByPosition } from "../_utils/position-keys";
import { ACTIVITY_FIELD_CLASS } from "./activity-canvas";
import { ActivityHorizontalScroll } from "./activity-horizontal-scroll";

const TOKEN_CLASSES: Record<CodeTokenKind, string> = {
  builtin: "text-viz-secondary",
  comment: "text-muted-foreground italic",
  keyword: "text-viz-accent",
  number: "text-viz-highlight",
  plain: "",
  string: "text-viz-highlight",
};

// Inputs below 16px trigger automatic zoom on iOS.
const CODE_TEXT = "font-mono text-base leading-7 sm:text-sm sm:leading-6";

export function ActivityCodeTokens({ tokens }: { tokens: readonly CodeToken[] }) {
  if (tokens.length === 0) {
    return <span> </span>;
  }

  return keyedByPosition(tokens, (token) => token.text).map(({ item, key }) => (
    <span className={TOKEN_CLASSES[item.kind]} key={key}>
      {item.text}
    </span>
  ));
}

export function ActivityCodeBlock({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <ActivityHorizontalScroll box={{ label }} className={cn("-mx-1", className)}>
      <div
        className={cn(
          "grid w-max min-w-full grid-cols-[max-content_minmax(0,1fr)] px-1 pb-1",
          CODE_TEXT,
        )}
      >
        {children}
      </div>
    </ActivityHorizontalScroll>
  );
}

type CodeLineTone = "current" | "editable" | "error" | "plain";

function lineText(tokens: readonly CodeToken[]): string {
  return tokens.map((token) => token.text).join("");
}

export function ActivityCodeLine({
  children,
  className,
  number,
  tone = "plain",
  ...props
}: React.ComponentProps<"div"> & { number: number; tone?: CodeLineTone }) {
  return (
    <div
      className={cn(
        "col-span-full grid grid-cols-subgrid items-center rounded-lg pr-2 whitespace-pre",
        tone === "current" &&
          "bg-viz-highlight-soft rounded-l-none shadow-[-3px_0_0_var(--color-viz-highlight)]",
        tone === "editable" &&
          "bg-background ring-viz-accent/40 contrast-more:ring-viz-accent ring-1 ring-inset",
        tone === "error" && "bg-destructive/10",
        className,
      )}
      data-slot="activity-code-line"
      data-tone={tone}
      {...props}
    >
      <span
        aria-hidden="true"
        className="text-muted-foreground pr-3 text-right tabular-nums select-none"
      >
        {number}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function ActivityCodeListing({
  code,
  label,
  language,
  toneOf,
}: {
  code: string;
  label: string;
  language: CodeLanguage;
  toneOf?: (lineNumber: number) => CodeLineTone;
}) {
  return (
    <ActivityCodeBlock label={label}>
      {keyedByPosition(highlightCode(code, language), lineText).map(({ item, key }, index) => {
        const tone = toneOf?.(index + 1) ?? "plain";

        return (
          <ActivityCodeLine
            aria-current={tone === "current" ? "step" : undefined}
            key={key}
            number={index + 1}
            tone={tone}
          >
            <ActivityCodeTokens tokens={item} />
          </ActivityCodeLine>
        );
      })}
    </ActivityCodeBlock>
  );
}

const FIELD_RESET =
  "col-start-1 row-start-1 m-0 min-w-0 resize-none overflow-hidden border-0 bg-transparent p-0 whitespace-pre text-transparent caret-foreground outline-none selection:bg-viz-accent-soft placeholder:text-muted-foreground";

export function ActivityCodeLineInput({
  className,
  language,
  onChange,
  value,
  ...props
}: Omit<React.ComponentProps<"input">, "onChange" | "value"> & {
  language: CodeLanguage;
  onChange: (value: string) => void;
  value: string;
}) {
  const kept = useKeptTyping({ value });

  return (
    <span className={cn("grid min-w-0 flex-1", className)} data-slot="activity-code-line-input">
      <span aria-hidden="true" className="col-start-1 row-start-1 self-center whitespace-pre">
        <ActivityCodeTokens tokens={highlightCode(value, language)[0] ?? []} />
      </span>

      <input
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        className={cn(FIELD_RESET, "min-h-11 w-full [font:inherit]")}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        type="text"
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
  language: CodeLanguage;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  value: string;
}) {
  const lines = value.split("\n");
  const kept = useKeptTyping({ value });

  return (
    <div className={cn(ACTIVITY_FIELD_CLASS, className)} data-slot="activity-code-editor">
      <ActivityHorizontalScroll box={{ label }}>
        <div className={cn("grid w-max min-w-full px-4 py-3", CODE_TEXT)}>
          <div aria-hidden="true" className="col-start-1 row-start-1 whitespace-pre">
            {keyedByPosition(highlightCode(value, language), lineText).map(({ item, key }) => (
              <div key={key}>
                <ActivityCodeTokens tokens={item} />
              </div>
            ))}
          </div>

          <textarea
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className={cn(FIELD_RESET, "min-h-11 w-full [font:inherit]")}
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
            wrap="off"
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
    <ActivityHorizontalScroll box={{ label }}>
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

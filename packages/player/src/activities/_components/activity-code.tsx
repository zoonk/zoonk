"use client";

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

const TOKEN_CLASSES: Record<CodeTokenKind, string> = {
  builtin: "text-viz-secondary",
  comment: "text-muted-foreground italic",
  keyword: "text-viz-accent",
  number: "text-viz-highlight",
  plain: "",
  string: "text-viz-highlight",
};

/**
 * Code text shared by every code surface. 16px on phones, where smaller inputs make iOS zoom in,
 * and 14px from `sm` up.
 */
const CODE_TEXT = "font-mono text-base leading-7 sm:text-sm sm:leading-6";

/** One line of code, colored. Empty lines keep their height. */
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

/**
 * Where code sits: monospace, never wrapped, scrolling sideways when a line is longer than the
 * screen. Lines inside keep one width, so a highlighted line spans the whole block. It takes focus
 * so keyboard learners can scroll a long line into view with the arrow keys.
 */
export function ActivityCodeBlock({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "focus-visible:ring-ring/50 -mx-1 overflow-x-auto rounded-md px-1 pb-1 outline-none focus-visible:ring-[3px]",
        className,
      )}
      data-slot="activity-code-block"
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- A scrolling region needs focus to scroll by keyboard.
      tabIndex={0}
      {...props}
    >
      <div className={cn("flex w-max min-w-full flex-col", CODE_TEXT)}>{children}</div>
    </div>
  );
}

type CodeLineTone = "current" | "editable" | "error" | "plain";

function lineText(tokens: readonly CodeToken[]): string {
  return tokens.map((token) => token.text).join("");
}

/** A numbered line. The number is decoration; screen readers get the code. */
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
        "flex items-center rounded-lg pr-2 whitespace-pre",
        tone === "current" &&
          "bg-viz-highlight-soft border-viz-highlight rounded-l-none border-l-[3px]",
        tone === "editable" && "bg-background ring-viz-accent/40 ring-1",
        tone === "error" && "bg-destructive/10",
        className,
      )}
      data-slot="activity-code-line"
      data-tone={tone}
      {...props}
    >
      <span
        aria-hidden="true"
        className="text-muted-foreground w-8 shrink-0 pr-3 text-right tabular-nums select-none"
      >
        {number}
      </span>
      {children}
    </div>
  );
}

/**
 * A whole read-only program, colored and numbered. `toneOf` marks lines, like the one that just
 * ran or the one with an error.
 */
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
    <ActivityCodeBlock aria-label={label} role="group">
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

/**
 * An editable line of code that stays colored as the learner types: the colored text sits under
 * a transparent input with the same metrics, so the caret and selection line up with it. The line
 * is 44 px tall so it's easy to tap, with both layers centered in it.
 */
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
      />
    </span>
  );
}

/**
 * A multi-line code editor with the same colored-underlay technique. It grows with its lines
 * instead of scrolling inside, so it never hides what the learner wrote, and is at least 44 px
 * tall so a one-line query is easy to tap.
 */
export function ActivityCodeEditor({
  className,
  editorRef,
  language,
  onChange,
  onSubmit,
  value,
  ...props
}: Omit<React.ComponentProps<"textarea">, "onChange" | "value"> & {
  editorRef?: React.Ref<HTMLTextAreaElement>;
  language: CodeLanguage;
  onChange: (value: string) => void;
  /** Ctrl or Cmd + Enter, the usual "run" shortcut in code editors. */
  onSubmit?: () => void;
  value: string;
}) {
  const lines = value.split("\n");

  return (
    <div
      className={cn(
        "bg-background focus-within:border-ring focus-within:ring-ring/50 overflow-x-auto rounded-2xl border px-4 py-3 focus-within:ring-[3px]",
        className,
      )}
      data-slot="activity-code-editor"
    >
      <div className={cn("grid w-max min-w-full", CODE_TEXT)}>
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
        />
      </div>
    </div>
  );
}

/**
 * Inserts a snippet where the cursor is in a text field and puts the cursor back, for snippet
 * buttons that save typing symbols on a phone keyboard.
 */
export function useInsertSnippet({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const cursorRef = useRef<number | null>(null);

  /*
   * After React writes the new text (which moves the caret to the end), the caret goes back to
   * just after the snippet. It runs after every render but only acts once per insert, before the
   * next key or tap, so nothing lands elsewhere.
   */
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

/** Buttons that type symbols that are hard to reach on a phone keyboard. */
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
    <div
      aria-label={label}
      className="flex gap-1.5 overflow-x-auto pb-1"
      data-slot="activity-snippet-bar"
      role="toolbar"
    >
      {snippets.map((snippet) => (
        <button
          aria-label={snippet.name}
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 focus-visible:ring-ring/50 flex h-11 min-w-11 shrink-0 items-center justify-center rounded-xl px-3 font-mono text-sm outline-none focus-visible:ring-[3px] disabled:opacity-50"
          disabled={disabled}
          key={snippet.label}
          onClick={() => onInsert(snippet)}
          // Keeps the text field's cursor where it was while the button is pressed.
          onMouseDown={(event) => event.preventDefault()}
          type="button"
        >
          {snippet.label}
        </button>
      ))}
    </div>
  );
}

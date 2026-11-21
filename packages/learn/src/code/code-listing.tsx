import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Fragment } from "react";
import { SidewaysScroll } from "../_components/sideways-scroll";
import { BreakPoint, breaksBetween, withBreakPoints, withWordBreakPoints } from "./code-breaks";
import { type CodeTokenKind } from "./code-languages";
import { type CodeToken, codeLineText, highlightCode } from "./highlight-code";
import { useSpokenCode } from "./spoken-code";

const TAB_SIZE = 4;

/** Code reads at a table's size. */
const CODE_TEXT = "font-mono text-sm leading-6 [tab-size:4]";

/** Code with a field in it: below 16px, iOS zooms in when the field takes focus. */
export const CODE_FIELD_TEXT = "font-mono text-base leading-7 sm:text-sm sm:leading-6 [tab-size:4]";

/** Code's scroll buttons show on touch screens too, since a program rarely looks cut off. */
export const CODE_SCROLL_SIGN = "[&>button]:pointer-coarse:inline-flex";

const TOKEN_CLASSES: Record<CodeTokenKind, string> = {
  builtin: "text-viz-secondary-text",
  comment: "text-muted-foreground italic",
  keyword: "text-viz-accent-text",
  number: "text-viz-highlight-text",
  plain: "",
  string: "text-viz-highlight-text",
};

const CONTINUATION_ARROW =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 10 5 5-5 5"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/></svg>';

// One arrow per extra row a wrapped line takes, under its number.
const CONTINUATION_MARKS = {
  maskImage: `url("data:image/svg+xml,${encodeURIComponent(CONTINUATION_ARROW)}")`,
  maskPosition: "right top",
  maskRepeat: "repeat-y",
  maskSize: "0.75em 1lh",
} satisfies React.CSSProperties;

/**
 * A line's colored runs. A `field`'s mirror wraps exactly where the field's own text does, so it
 * gets no extra break points.
 */
export function CodeTokens({
  field = false,
  tokens,
}: {
  field?: boolean;
  tokens: readonly CodeToken[];
}) {
  if (tokens.length === 0) {
    return <span> </span>;
  }

  return tokens.map((token, index) => {
    const key = `${index}:${token.text}`;
    const breaksBefore = !field && breaksBetween(tokens[index - 1]?.text ?? "", token.text);

    return (
      <Fragment key={key}>
        {breaksBefore && <BreakPoint />}
        <span className={TOKEN_CLASSES[token.kind]}>
          {token.kind === "plain" && !field ? withBreakPoints(token.text) : token.text}
        </span>
      </Fragment>
    );
  });
}

/**
 * A line's number, in a column that stays put while the code scrolls sideways under it, on the
 * code's own ground (`--code-surface`).
 */
export function CodeLineNumber({ number, style }: { number: number; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className="text-muted-foreground sticky left-0 z-10 col-start-1 flex w-(--code-gutter) flex-col self-stretch bg-(--code-surface) pr-1.5 text-right tabular-nums select-none"
      style={style}
    >
      {number}
      <span className="flex-1 bg-current" style={CONTINUATION_MARKS} />
    </span>
  );
}

export type CodeLineTone = "current" | "editable" | "error" | "plain";

function indentOf(tokens: readonly CodeToken[]): number {
  const leading = /^[ \t]*/u.exec(codeLineText(tokens))?.[0] ?? "";

  return leading
    .split("")
    .reduce(
      (column, character) =>
        character === "\t" ? column + TAB_SIZE - (column % TAB_SIZE) : column + 1,
      0,
    );
}

/** The rows a wrapped line takes after its first start `indent` characters in. */
function wrapIndent(indent: number): React.CSSProperties | undefined {
  return indent > 0 ? { paddingInlineStart: `${indent}ch`, textIndent: `-${indent}ch` } : undefined;
}

/** Below this, a block wraps its lines; from it, they keep their shape and the block scrolls. */
const KEEPS_SHAPE = "@min-[30rem]:whitespace-pre";

/**
 * A numbered line. In a narrow block it wraps, its extra rows marked under its number and starting
 * at the line's own `indent`; in a wide one it keeps its shape. Its `tone` starts after its number.
 * `spoken` is what a screen reader says for it (`useSpokenCode`), in place of its code; a line of
 * fields leaves it out and labels its fields.
 */
export function CodeLine({
  children,
  className,
  indent = 0,
  number,
  spoken,
  tone = "plain",
  ...props
}: React.ComponentProps<"div"> & {
  indent?: number;
  number: number;
  spoken?: string;
  tone?: CodeLineTone;
}) {
  return (
    <div
      className={cn("col-span-full grid grid-cols-subgrid items-start", className)}
      data-slot="code-line"
      data-tone={tone}
      {...props}
    >
      <CodeLineNumber number={number} />

      <div
        aria-hidden={spoken === undefined ? undefined : true}
        className={cn(
          "min-w-0 rounded-lg px-1.5 wrap-anywhere whitespace-pre-wrap",
          KEEPS_SHAPE,
          tone === "current" &&
            "bg-viz-highlight-soft rounded-l-none shadow-[inset_3px_0_0_var(--color-viz-highlight)]",
          tone === "editable" &&
            "bg-background ring-viz-accent/40 contrast-more:ring-viz-accent ring-1 ring-inset",
          tone === "error" && "bg-destructive/10",
        )}
      >
        <div style={wrapIndent(indent)}>{children}</div>
      </div>

      {spoken !== undefined && <span className="sr-only select-none">{spoken}</span>}
    </div>
  );
}

/**
 * Where code sits: `inset` flush in an activity's card, its lines reaching a little past the card's
 * content so a line's tone has room; `panel` on its own muted panel, in text.
 */
type CodeFrameVariant = "inset" | "panel";

const CODE_SURFACE: Record<CodeFrameVariant, string> = {
  inset: "var(--background)",
  panel: "var(--muted)",
};

/**
 * Lines of code (`lineCount` of them), which wrap in a narrow block and scroll sideways in a wide
 * one, as a table does, their numbers staying put (`label` says what scrolls). `field` sizes it for
 * a field inside it. Code reads left to right in every language.
 */
export function CodeFrame({
  children,
  className,
  field = false,
  label,
  lineCount,
  variant = "inset",
}: {
  children: React.ReactNode;
  className?: string;
  field?: boolean;
  label: string;
  lineCount: number;
  variant?: CodeFrameVariant;
}) {
  const style: React.CSSProperties & Record<`--${string}`, string> = {
    "--code-gutter": `calc(${String(lineCount).length}ch + 0.375rem)`,
    "--code-surface": CODE_SURFACE[variant],
  };

  return (
    <div
      className={cn(
        "has-[[data-slot=sideways-scroll]:focus-visible]:ring-ring/50 @container rounded-lg has-[[data-slot=sideways-scroll]:focus-visible]:ring-[3px]",
        variant === "inset" && "-mx-2 pl-2",
        variant === "panel" &&
          "bg-muted text-foreground rounded-xl pl-3 font-normal tracking-normal not-italic",
        className,
      )}
      data-variant={variant}
      dir="ltr"
      style={style}
      translate="no"
    >
      <SidewaysScroll
        className={cn(
          field ? CODE_FIELD_TEXT : CODE_TEXT,
          "[--scroll-fade-x-inset:var(--code-gutter)]",
        )}
        label={label}
        role="group"
      >
        <div
          className={cn(
            "grid w-full min-w-full grid-cols-[max-content_minmax(0,1fr)] @min-[30rem]:w-max",
            variant === "inset" ? "pr-2 pb-1" : "py-2.5 pr-3",
          )}
          data-slot="code-lines"
        >
          {children}
        </div>
      </SidewaysScroll>
    </div>
  );
}

type CodeListingProps = {
  code: string;
  label: string;
  language: string | null;
  /** What a screen reader says for a line; given only where no translations load, such as Admin. */
  speakLine?: (text: string, number: number) => string;
  toneOf?: (lineNumber: number) => CodeLineTone;
  variant?: CodeFrameVariant;
};

function TranslatedCodeListing(props: CodeListingProps) {
  const { line } = useSpokenCode();
  return <CodeListing {...props} speakLine={line} />;
}

/** A program with its lines numbered. `language` is a fence's name for it, or null. */
export function CodeListing(props: CodeListingProps) {
  const { code, label, language, speakLine, toneOf, variant } = props;

  if (!speakLine) {
    return <TranslatedCodeListing {...props} />;
  }

  const lines = highlightCode(code, language);

  return (
    <CodeFrame label={label} lineCount={lines.length} variant={variant}>
      {lines.map((tokens, index) => {
        const tone = toneOf?.(index + 1) ?? "plain";
        const text = codeLineText(tokens);
        const key = `${index}:${text}`;

        return (
          <CodeLine
            aria-current={tone === "current" ? "step" : undefined}
            indent={indentOf(tokens)}
            key={key}
            number={index + 1}
            spoken={speakLine(text, index + 1)}
            tone={tone}
          >
            <CodeTokens tokens={tokens} />
          </CodeLine>
        );
      })}
    </CodeFrame>
  );
}

/** With no line numbers to mark a wrapped line's extra rows, they start a little further in. */
const SNIPPET_HANG = 2;

/**
 * Code inside something the learner presses or reads in one line, such as an answer option: no
 * scroller and no line numbers, each line wrapped with its extra rows indented. Spans, so it fits
 * inside a button or a sentence. As wide as its widest line, so an option's tag sits after its last
 * line when there's room, as it follows an answer's words.
 */
export function CodeSnippet({ code, language }: { code: string; language: string | null }) {
  const { snippet } = useSpokenCode();

  return (
    <span
      className={cn(
        CODE_TEXT,
        "inline-block max-w-full text-start align-baseline font-normal tracking-normal not-italic",
      )}
      data-slot="code-snippet"
      dir="ltr"
      translate="no"
    >
      <span aria-hidden="true">
        {highlightCode(code, language).map((tokens, index) => {
          const key = `${index}:${codeLineText(tokens)}`;

          return (
            <span
              className="block wrap-anywhere whitespace-pre-wrap"
              key={key}
              style={wrapIndent(indentOf(tokens) + SNIPPET_HANG)}
            >
              <CodeTokens tokens={tokens} />
            </span>
          );
        })}
      </span>

      <span className="sr-only select-none">{snippet(code)}</span>
    </span>
  );
}

/**
 * Code inside a sentence. A word of it short enough to fit on a line moves to the next one whole;
 * a longer one splits where a code line would, its pieces ending flush with the column.
 */
export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="bg-muted text-foreground rounded-sm px-1 py-0.5 font-mono text-[0.85em] leading-tight wrap-break-word"
      translate="no"
    >
      {typeof children === "string" ? withWordBreakPoints(children) : children}
    </code>
  );
}

/** A fenced block in a lesson's or a question's text. */
export function CodeBlock({ code, language }: { code: string; language: string | null }) {
  const t = useExtracted();

  return (
    <CodeListing
      code={code}
      label={t({
        description:
          "Name of a block of program code in a lesson or a question, read by screen readers.",
        message: "Code",
      })}
      language={language}
      variant="panel"
    />
  );
}

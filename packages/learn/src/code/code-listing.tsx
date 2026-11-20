import { HorizontalScroll } from "@zoonk/ui/components/horizontal-scroll";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { Fragment } from "react";
import { breaksBetween, withBreakPoints } from "./code-breaks";
import { type CodeTokenKind } from "./code-languages";
import { type CodeToken, codeLineText, highlightCode } from "./highlight-code";

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
        {breaksBefore && <wbr />}
        <span className={TOKEN_CLASSES[token.kind]}>
          {token.kind === "plain" && !field ? withBreakPoints(token.text) : token.text}
        </span>
      </Fragment>
    );
  });
}

export function CodeLineNumber({ number, style }: { number: number; style?: React.CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className="text-muted-foreground col-start-1 flex flex-col self-stretch pr-3 text-right tabular-nums select-none"
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

/**
 * A line wraps on a phone, its extra rows marked under its number and starting at the line's own
 * `indent`, and keeps its shape from `sm`.
 */
export function CodeLine({
  children,
  className,
  indent = 0,
  number,
  tone = "plain",
  ...props
}: React.ComponentProps<"div"> & { indent?: number; number: number; tone?: CodeLineTone }) {
  return (
    <div
      className={cn(
        "col-span-full -mx-1.5 grid grid-cols-subgrid items-start rounded-lg px-1.5 wrap-anywhere whitespace-pre-wrap sm:whitespace-pre",
        tone === "current" &&
          "bg-viz-highlight-soft rounded-l-none shadow-[inset_3px_0_0_var(--color-viz-highlight)]",
        tone === "editable" &&
          "bg-background ring-viz-accent/40 contrast-more:ring-viz-accent ring-1 ring-inset",
        tone === "error" && "bg-destructive/10",
        className,
      )}
      data-slot="code-line"
      data-tone={tone}
      {...props}
    >
      <CodeLineNumber number={number} />
      <div className="min-w-0" style={wrapIndent(indent)}>
        {children}
      </div>
    </div>
  );
}

/**
 * Where code sits: `inset` flush in an activity's card, its lines reaching a little past the card's
 * content so a line's tone has room; `panel` on its own muted panel, in text.
 */
type CodeFrameVariant = "inset" | "panel";

/**
 * Lines of code under one sideways scroller, for when a line is wider than the room (`label` says
 * what scrolls). `field` sizes it for a field inside it.
 */
export function CodeFrame({
  children,
  className,
  field = false,
  label,
  variant = "inset",
}: {
  children: React.ReactNode;
  className?: string;
  field?: boolean;
  label: string;
  variant?: CodeFrameVariant;
}) {
  const t = useExtracted();

  return (
    <HorizontalScroll
      box={{ label }}
      className={cn(
        CODE_SCROLL_SIGN,
        variant === "inset" && "-mx-2",
        variant === "panel" &&
          "bg-muted text-foreground rounded-xl font-normal tracking-normal not-italic *:[[role=group]]:rounded-xl",
        className,
      )}
      data-variant={variant}
      labels={{ left: t("Scroll left"), right: t("Scroll right") }}
    >
      <div
        className={cn(
          "grid w-full min-w-full grid-cols-[max-content_minmax(0,1fr)] sm:w-max",
          variant === "inset" ? "px-2 pb-1" : "px-3 py-2.5",
          field ? CODE_FIELD_TEXT : CODE_TEXT,
        )}
        data-slot="code-lines"
        dir="ltr"
        translate="no"
      >
        {children}
      </div>
    </HorizontalScroll>
  );
}

/** A program with its lines numbered. `language` is a fence's name for it, or null. */
export function CodeListing({
  code,
  label,
  language,
  toneOf,
  variant,
}: {
  code: string;
  label: string;
  language: string | null;
  toneOf?: (lineNumber: number) => CodeLineTone;
  variant?: CodeFrameVariant;
}) {
  return (
    <CodeFrame label={label} variant={variant}>
      {highlightCode(code, language).map((tokens, index) => {
        const tone = toneOf?.(index + 1) ?? "plain";
        const key = `${index}:${codeLineText(tokens)}`;

        return (
          <CodeLine
            aria-current={tone === "current" ? "step" : undefined}
            indent={indentOf(tokens)}
            key={key}
            number={index + 1}
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
 * inside a button or a sentence.
 */
export function CodeSnippet({ code, language }: { code: string; language: string | null }) {
  return (
    <span
      className={cn(CODE_TEXT, "block text-start font-normal tracking-normal not-italic")}
      data-slot="code-snippet"
      dir="ltr"
      translate="no"
    >
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
  );
}

/**
 * Code inside a sentence. Its pieces end flush where it splits over two lines, so a long run never
 * reaches past the column; text splits where a code line would.
 */
export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="bg-muted text-foreground rounded-sm px-1 py-0.5 font-mono text-[0.85em] leading-tight wrap-break-word"
      translate="no"
    >
      {typeof children === "string" ? withBreakPoints(children) : children}
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

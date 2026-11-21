"use client";

import { SidewaysScroll } from "@zoonk/ui/components/sideways-scroll";
import { useKeptTyping } from "@zoonk/ui/hooks/kept-typing";
import { cn } from "@zoonk/ui/lib/utils";
import {
  type CodeLanguage,
  type CodeToken,
  type CodeTokenKind,
  highlightCode,
} from "../_utils/highlight-code";
import { keyedByPosition } from "../_utils/position-keys";
import { ACTIVITY_FIELD_CLASS } from "./activity-canvas";
import { CodeLineNumber } from "./activity-code-gutter";

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
    <SidewaysScroll className={cn("-mx-2", className)} label={label}>
        <div
          className={cn(
            "grid w-full min-w-full grid-cols-[max-content_minmax(0,1fr)] px-2 pb-1 sm:w-max",
            CODE_TEXT,
          )}
        >
          {children}
        </div>
      </SidewaysScroll>
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
        "col-span-full -mx-1.5 grid grid-cols-subgrid items-start rounded-lg px-1.5 wrap-anywhere whitespace-pre-wrap sm:whitespace-pre",
        tone === "current" &&
          "bg-viz-highlight-soft rounded-l-none shadow-[inset_3px_0_0_var(--color-viz-highlight)]",
        tone === "editable" &&
          "bg-background ring-viz-accent/40 contrast-more:ring-viz-accent ring-1 ring-inset",
        tone === "error" && "bg-destructive/10",
        className,
      )}
      data-slot="activity-code-line"
      data-tone={tone}
      {...props}
    >
      <CodeLineNumber number={number} />
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
  language,
  onChange,
  value,
  ...props
}: Omit<React.ComponentProps<"textarea">, "onChange" | "value"> & {
  language: CodeLanguage;
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
        <ActivityCodeTokens tokens={highlightCode(value, language)[0] ?? []} />
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
  language: CodeLanguage;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  value: string;
}) {
  const lines = value.split("\n");
  const kept = useKeptTyping({ value });

  return (
    <div className={cn(ACTIVITY_FIELD_CLASS, className)} data-slot="activity-code-editor">
      <SidewaysScroll label={label}>
        <div
          className={cn("grid w-full grid-cols-[max-content_minmax(0,1fr)] px-3 py-3", CODE_TEXT)}
          style={{ gridTemplateRows: `repeat(${lines.length}, auto)` }}
        >
          {keyedByPosition(highlightCode(value, language), lineText).map(({ item, key }, index) => (
            <div aria-hidden="true" className="contents" key={key}>
              <CodeLineNumber number={index + 1} style={{ gridRow: index + 1 }} />

              <div
                className="col-start-2 wrap-anywhere whitespace-pre-wrap"
                style={{ gridRow: index + 1 }}
              >
                <ActivityCodeTokens tokens={item} />
              </div>
            </div>
          ))}

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
      </SidewaysScroll>
    </div>
  );
}

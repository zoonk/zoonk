"use client";

import { type WritingPrompt } from "@zoonk/core/exams/essays/writing-contract";
import { countWritingLines } from "@zoonk/core/exams/essays/writing-lines";
import { Textarea } from "@zoonk/ui/components/textarea";
import { cn } from "@zoonk/ui/lib/utils";
import { countWords } from "@zoonk/utils/string";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { ESSAY_FIELD_CLASS } from "../essay/essay-labels";

/**
 * The field holds focus for the whole answer, so its focus is a soft line, as the lesson's question
 * composer draws it; the usual ring returns with more contrast.
 */
const WRITING_FOCUS_CLASS =
  "focus-visible:border-foreground/35 focus-visible:ring-0 contrast-more:focus-visible:border-ring contrast-more:focus-visible:ring-[3px]";

/** "about 23 of 30 lines": the count stays in view under the field, and what's past the limit says so. */
export function WritingLineCount({
  id,
  text,
  writing,
}: {
  id: string;
  text: string;
  writing: WritingPrompt;
}) {
  const t = useExtracted();

  if (writing.lines === null) {
    return (
      <p className="text-muted-foreground font-mono text-xs tabular-nums" id={id}>
        {t("{count, plural, one {# word} other {# words}}", { count: countWords(text) })}
      </p>
    );
  }

  const { estimatedLines } = countWritingLines({
    charactersPerLine: writing.charactersPerLine,
    limit: writing.lines,
    text,
  });

  const over = estimatedLines - writing.lines;

  return (
    <p
      aria-live="polite"
      className={cn(
        "font-mono text-xs tabular-nums",
        over > 0 ? "text-warning-text" : "text-muted-foreground",
      )}
      id={id}
    >
      {over > 0
        ? t({
            description:
              "The approximate line count of a written answer past its limit; the lines past it are ones the exam board won't read.",
            message: "about {used} of {lines} lines · {over} won't be read",
            values: {
              lines: String(writing.lines),
              over: String(over),
              used: String(estimatedLines),
            },
          })
        : t("about {used} of {lines} lines", {
            lines: String(writing.lines),
            used: String(estimatedLines),
          })}
    </p>
  );
}

/** The field fills the screen; the count of lines a board would see stays under it. */
export function WritingEditor({
  label,
  onChange,
  text,
  writing,
}: {
  label: string;
  onChange: (text: string) => void;
  text: string;
  writing: WritingPrompt;
}) {
  const id = useId();

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2" data-slot="writing-editor">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Textarea
        aria-describedby={`${id}-count`}
        className={cn(ESSAY_FIELD_CLASS, WRITING_FOCUS_CLASS, "field-sizing-fixed min-h-0 flex-1")}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        value={text}
      />
      <WritingLineCount id={`${id}-count`} text={text} writing={writing} />
    </section>
  );
}

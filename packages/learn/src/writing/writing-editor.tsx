"use client";

import {
  MAX_ESSAY_CHARACTERS,
  type WritingPrompt,
} from "@zoonk/core/exams/essays/writing-contract";
import { countWritingLines } from "@zoonk/core/exams/essays/writing-lines";
import { Textarea } from "@zoonk/ui/components/textarea";
import { cn } from "@zoonk/ui/lib/utils";
import { countWords } from "@zoonk/utils/string";
import { useExtracted, useFormatter } from "next-intl";
import { useId } from "react";
import { ESSAY_FIELD_CLASS } from "../essay/essay-labels";

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
  const lines = String(writing.lines);

  const countLine = () => {
    if (!text.trim()) {
      return t("0 of {lines} lines", { lines });
    }

    return over > 0
      ? t({
          description:
            "The approximate line count of a written answer past its limit; the lines past it are ones the exam's graders won't read.",
          message: "about {used} of {lines} lines · {over} won't be read",
          values: { lines, over: String(over), used: String(estimatedLines) },
        })
      : t("about {used} of {lines} lines", { lines, used: String(estimatedLines) });
  };

  return (
    <p
      aria-live="polite"
      className={cn(
        "font-mono text-xs tabular-nums",
        over > 0 ? "text-warning-text" : "text-muted-foreground",
      )}
      id={id}
    >
      {countLine()}
    </p>
  );
}

/** A copy restored from before the field had its limit: it says what to cut instead of failing to save. */
function TooLong({ text }: { text: string }) {
  const t = useExtracted();
  const format = useFormatter();
  const over = text.length - MAX_ESSAY_CHARACTERS;

  if (over <= 0) {
    return null;
  }

  return (
    <p className="text-destructive-text text-sm" role="alert">
      {t("This answer is {count} characters too long. Shorten it to save and grade it.", {
        count: format.number(over),
      })}
    </p>
  );
}

/**
 * The field fills the screen; the count of lines graders would read stays under it. It takes no
 * more than the server saves and grades, and no edits while `readOnly`.
 */
export function WritingEditor({
  label,
  onChange,
  readOnly = false,
  text,
  writing,
}: {
  label: string;
  onChange: (text: string) => void;
  readOnly?: boolean;
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
        className={cn(ESSAY_FIELD_CLASS, "field-sizing-fixed min-h-0 flex-1")}
        id={id}
        maxLength={MAX_ESSAY_CHARACTERS}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        value={text}
      />
      <WritingLineCount id={`${id}-count`} text={text} writing={writing} />
      <TooLong text={text} />
    </section>
  );
}
